const store = require('./autoPostStore');

// Map key: `${guildId}:${jobId}` -> Interval handle
const timers = new Map();

function key(guildId, jobId) { return `${guildId}:${jobId}`; }

function stopJob(guildId, jobId) {
  const k = key(guildId, jobId);
  const h = timers.get(k);
  if (h) {
    clearInterval(h);
    timers.delete(k);
  }
}

function startJob(client, guildId, job) {
  stopJob(guildId, job.id);
  if (!job.enabled) return;
  const interval = Math.max(60000, Number(job.intervalMs) || 60000);
  const k = key(guildId, job.id);
  const handle = setInterval(async () => {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      let channel = guild.channels.cache.get(job.channelId);
      if (!channel) {
        try { channel = await guild.channels.fetch(job.channelId); } catch (err) { console.error('src/utils/autoPostScheduler.js', err); channel = null; }
      }
      if (!channel) return;
      await channel.send({ content: job.message, allowedMentions: { parse: [] } });
    } catch (err) { console.error('src/utils/autoPostScheduler.js', err); }
  }, interval);
  timers.set(k, handle);
}

function reloadGuild(client, guildId) {
  // stop existing
  for (const k of Array.from(timers.keys())) {
    if (k.startsWith(`${guildId}:`)) {
      clearInterval(timers.get(k));
      timers.delete(k);
    }
  }
  // start all enabled
  const jobs = store.listJobs(guildId);
  for (const job of jobs) startJob(client, guildId, job);
}

function startAll(client) {
  const guilds = Array.from(client.guilds.cache.keys());
  for (const gid of guilds) reloadGuild(client, gid);
}

module.exports = { startAll, reloadGuild, startJob, stopJob };

