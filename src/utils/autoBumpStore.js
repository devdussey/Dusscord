const fs = require('fs/promises');
const { ensureFile, resolveDataPath, writeJson } = require('./dataDir');
const { getDefaultIntervalMs, getDefaultCommand } = require('./autoBumpServices');

const STORE_FILE = 'autobump.json';
const MIN_INTERVAL_MS = 60_000;
const DEFAULT_START_DELAY_MS = 60_000;

let cache = null;
let loadPromise = null;
let saveTimeout = null;

function getDataFile() {
  return resolveDataPath(STORE_FILE);
}

async function ensureLoaded() {
  if (cache) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }
  loadPromise = (async () => {
    try {
      await ensureFile(STORE_FILE, '{}');
      const raw = await fs.readFile(getDataFile(), 'utf8').catch(err => {
        if (err.code === 'ENOENT') return '{}';
        throw err;
      });
      cache = JSON.parse(raw || '{}');
    } catch (err) {
      console.error('Failed to load autobump store:', err);
      cache = {};
    } finally {
      loadPromise = null;
    }
  })();
  await loadPromise;
}

function schedulePersist() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    try {
      const safe = cache && typeof cache === 'object' ? cache : {};
      await writeJson(STORE_FILE, safe);
    } catch (err) {
      console.error('Failed to persist autobump store:', err);
    }
  }, 100);
}

function normalizeJob(job) {
  if (!job) return job;
  job.channelId = String(job.channelId || '');
  job.service = String(job.service || 'custom');
  job.command = String(job.command || '').slice(0, 2000);
  job.intervalMs = Math.max(MIN_INTERVAL_MS, Number(job.intervalMs) || getDefaultIntervalMs(job.service));
  job.allowMentions = !!job.allowMentions;
  job.enabled = !!job.enabled;
  job.lastRunAt = typeof job.lastRunAt === 'number' ? job.lastRunAt : null;
  job.nextRunAt = typeof job.nextRunAt === 'number' ? job.nextRunAt : null;
  job.lastError = typeof job.lastError === 'string' ? job.lastError.slice(0, 300) : null;
  job.createdAt = typeof job.createdAt === 'number' ? job.createdAt : Date.now();
  if (!job.command) job.command = getDefaultCommand(job.service) || '';
  return job;
}

function getGuildSync(guildId) {
  if (!cache[guildId]) {
    cache[guildId] = { nextId: 1, jobs: [] };
    schedulePersist();
  }
  const cfg = cache[guildId];
  if (!cfg.nextId || typeof cfg.nextId !== 'number') cfg.nextId = 1;
  if (!Array.isArray(cfg.jobs)) cfg.jobs = [];
  cfg.jobs = cfg.jobs.map(normalizeJob);
  return cfg;
}

async function getGuild(guildId) {
  await ensureLoaded();
  return getGuildSync(guildId);
}

async function listJobs(guildId) {
  const cfg = await getGuild(guildId);
  return cfg.jobs.map(job => ({ ...job }));
}

async function getJob(guildId, id) {
  const cfg = await getGuild(guildId);
  const job = cfg.jobs.find(j => j.id === Number(id));
  return job ? { ...job } : null;
}

function withMutatedJob(cfg, id, mutator) {
  const job = cfg.jobs.find(j => j.id === Number(id));
  if (!job) return null;
  mutator(job);
  normalizeJob(job);
  schedulePersist();
  return { ...job };
}

async function addJob(guildId, options) {
  const {
    channelId,
    service,
    command,
    intervalMs,
    allowMentions = false,
    startAfterMs = DEFAULT_START_DELAY_MS,
  } = options;
  const cfg = await getGuild(guildId);
  const id = cfg.nextId++;
  const job = normalizeJob({
    id,
    channelId,
    service,
    command,
    intervalMs: Math.max(MIN_INTERVAL_MS, Number(intervalMs) || getDefaultIntervalMs(service)),
    allowMentions: !!allowMentions,
    enabled: true,
    createdAt: Date.now(),
    lastRunAt: null,
    nextRunAt: Date.now() + Math.max(MIN_INTERVAL_MS, Number(startAfterMs) || DEFAULT_START_DELAY_MS),
    lastError: null,
  });
  cfg.jobs.push(job);
  schedulePersist();
  return { ...job };
}

async function removeJob(guildId, id) {
  const cfg = await getGuild(guildId);
  const before = cfg.jobs.length;
  cfg.jobs = cfg.jobs.filter(j => j.id !== Number(id));
  const removed = cfg.jobs.length !== before;
  if (removed) schedulePersist();
  return removed;
}

async function setEnabled(guildId, id, enabled) {
  const cfg = await getGuild(guildId);
  return withMutatedJob(cfg, id, job => {
    job.enabled = !!enabled;
    if (job.enabled) {
      job.nextRunAt = Date.now() + Math.max(MIN_INTERVAL_MS, job.intervalMs);
      job.lastError = null;
    } else {
      job.nextRunAt = null;
    }
  });
}

async function updateCommand(guildId, id, command) {
  const cfg = await getGuild(guildId);
  return withMutatedJob(cfg, id, job => {
    job.command = String(command || '').slice(0, 2000);
  });
}

async function updateInterval(guildId, id, intervalMs) {
  const cfg = await getGuild(guildId);
  return withMutatedJob(cfg, id, job => {
    job.intervalMs = Math.max(MIN_INTERVAL_MS, Number(intervalMs) || job.intervalMs);
  });
}

async function markRunSuccess(guildId, id) {
  const cfg = await getGuild(guildId);
  return withMutatedJob(cfg, id, job => {
    const now = Date.now();
    job.lastRunAt = now;
    job.nextRunAt = now + Math.max(MIN_INTERVAL_MS, job.intervalMs);
    job.lastError = null;
  });
}

async function markRunFailure(guildId, id, delayMs, errorMessage) {
  const cfg = await getGuild(guildId);
  return withMutatedJob(cfg, id, job => {
    const now = Date.now();
    job.lastError = errorMessage ? String(errorMessage).slice(0, 300) : 'Unknown error';
    job.nextRunAt = now + Math.max(MIN_INTERVAL_MS, Number(delayMs) || job.intervalMs || MIN_INTERVAL_MS);
  });
}

module.exports = {
  listJobs,
  getJob,
  addJob,
  removeJob,
  setEnabled,
  updateCommand,
  updateInterval,
  markRunSuccess,
  markRunFailure,
};
