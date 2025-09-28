const { ChannelType } = require('discord.js');
const store = require('./autoBumpStore');
const { getService, getDefaultCommand, getDefaultIntervalMs } = require('./autoBumpServices');

const timers = new Map();
const MIN_DELAY_MS = 5_000;
const FAILURE_RETRY_MINUTES = 15;

function key(guildId, jobId) {
  return `${guildId}:${jobId}`;
}

function stopJob(guildId, jobId) {
  const k = key(guildId, jobId);
  const timer = timers.get(k);
  if (timer) {
    clearTimeout(timer);
    timers.delete(k);
  }
}

function computeDelay(job) {
  const now = Date.now();
  if (job.nextRunAt && job.nextRunAt > now) {
    return Math.max(MIN_DELAY_MS, job.nextRunAt - now);
  }
  return Math.max(MIN_DELAY_MS, Number(job.intervalMs) || getDefaultIntervalMs(job.service));
}

function schedule(client, guildId, job) {
  stopJob(guildId, job.id);
  if (!job.enabled) return;
  const delay = computeDelay(job);
  const k = key(guildId, job.id);
  const timer = setTimeout(async () => {
    try {
      const fresh = await store.getJob(guildId, job.id);
      if (!fresh || !fresh.enabled) {
        timers.delete(k);
        return;
      }
      await runJob(client, guildId, fresh);
    } catch (err) {
      console.error(`Autobump job ${guildId}/${job.id} crashed:`, err);
      await store.markRunFailure(guildId, job.id, FAILURE_RETRY_MINUTES * 60 * 1000, err?.message);
      const updated = await store.getJob(guildId, job.id);
      if (updated && updated.enabled) schedule(client, guildId, updated);
      return;
    }
    const updated = await store.getJob(guildId, job.id);
    if (updated && updated.enabled) schedule(client, guildId, updated);
  }, delay);
  timers.set(k, timer);
}

async function runJob(client, guildId, job) {
  const service = getService(job.service);
  const content = String(job.command || service?.defaultCommand || getDefaultCommand(job.service) || '').trim();
  if (!content) {
    await store.markRunFailure(guildId, job.id, FAILURE_RETRY_MINUTES * 60 * 1000, 'No command configured.');
    return;
  }

  const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    await store.markRunFailure(guildId, job.id, FAILURE_RETRY_MINUTES * 60 * 1000, 'Guild unavailable.');
    return;
  }

  let channel = guild.channels.cache.get(job.channelId);
  if (!channel) {
    try {
      channel = await guild.channels.fetch(job.channelId);
    } catch (_) {
      channel = null;
    }
  }

  if (!channel) {
    await store.markRunFailure(guildId, job.id, FAILURE_RETRY_MINUTES * 60 * 1000, 'Channel not found.');
    return;
  }

  if (!channel.isTextBased() || channel.type === ChannelType.GuildVoice) {
    await store.markRunFailure(guildId, job.id, FAILURE_RETRY_MINUTES * 60 * 1000, 'Channel not text-based.');
    return;
  }

  try {
    await channel.send({
      content,
      allowedMentions: job.allowMentions ? undefined : { parse: [] },
    });
    await store.markRunSuccess(guildId, job.id);
  } catch (err) {
    await store.markRunFailure(guildId, job.id, FAILURE_RETRY_MINUTES * 60 * 1000, err?.message || 'Failed to send command.');
  }
}

async function startJob(client, guildId, job) {
  const fresh = job || await store.getJob(guildId, job?.id);
  if (!fresh) return;
  schedule(client, guildId, fresh);
}

async function reloadGuild(client, guildId) {
  for (const timerKey of Array.from(timers.keys())) {
    if (timerKey.startsWith(`${guildId}:`)) {
      clearTimeout(timers.get(timerKey));
      timers.delete(timerKey);
    }
  }
  const jobs = await store.listJobs(guildId);
  for (const job of jobs) {
    if (job.enabled) schedule(client, guildId, job);
  }
}

async function startAll(client) {
  const guildIds = Array.from(client.guilds.cache.keys());
  for (const gid of guildIds) {
    // eslint-disable-next-line no-await-in-loop
    await reloadGuild(client, gid);
  }
}

module.exports = {
  startAll,
  reloadGuild,
  startJob,
  stopJob,
};
