const fs = require('fs/promises');
const { ensureFile, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = 'autopost.json';

function getDataFile() {
  return resolveDataPath(STORE_FILE);
}

let cache = null;
let loadPromise = null;
let saveTimeout = null;

async function ensureLoaded() {
  if (cache) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      await ensureFile(STORE_FILE, '{}');
      const raw = await fs.readFile(getDataFile(), 'utf8').catch(err => {
        if (err.code === 'ENOENT') return '{}';
        throw err;
      });
      cache = JSON.parse(raw || '{}');
    } catch (err) {
      console.error('Failed to load autopost store:', err);
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
      console.error('Failed to persist autopost store:', err);
    }
  }, 100);
}

function getGuildSync(guildId) {
  if (!cache[guildId]) {
    cache[guildId] = { nextId: 1, jobs: [] };
    schedulePersist();
  }
  const cfg = cache[guildId];
  if (!cfg.nextId || typeof cfg.nextId !== 'number') cfg.nextId = 1;
  if (!Array.isArray(cfg.jobs)) cfg.jobs = [];
  return cfg;
}

async function getGuild(guildId) {
  await ensureLoaded();
  return getGuildSync(guildId);
}

async function listJobs(guildId) {
  const cfg = await getGuild(guildId);
  return cfg.jobs.slice();
}

async function addJob(guildId, { channelId, message, intervalMs }) {
  const cfg = await getGuild(guildId);
  const id = cfg.nextId++;
  const job = {
    id,
    channelId,
    message: String(message || '').slice(0, 2000),
    intervalMs: Math.max(60000, Number(intervalMs) || 60000),
    enabled: true,
  };
  cfg.jobs.push(job);
  schedulePersist();
  return job;
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
  const job = cfg.jobs.find(j => j.id === Number(id));
  if (!job) return null;
  job.enabled = !!enabled;
  schedulePersist();
  return job;
}

module.exports = {
  listJobs,
  addJob,
  removeJob,
  setEnabled,
  getGuild,
};

