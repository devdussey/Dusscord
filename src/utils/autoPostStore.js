const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'autopost.json');

let cache = null;

function ensureLoaded() {
  if (cache) return;
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(dataFile)) {
      cache = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } else {
      cache = {};
    }
  } catch {
    cache = {};
  }
}

function persist() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(cache, null, 2), 'utf8');
}

function getGuild(guildId) {
  ensureLoaded();
  if (!cache[guildId]) {
    cache[guildId] = { nextId: 1, jobs: [] };
    persist();
  }
  const cfg = cache[guildId];
  if (!cfg.nextId || typeof cfg.nextId !== 'number') cfg.nextId = 1;
  if (!Array.isArray(cfg.jobs)) cfg.jobs = [];
  return cfg;
}

function listJobs(guildId) {
  const cfg = getGuild(guildId);
  return cfg.jobs.slice();
}

function addJob(guildId, { channelId, message, intervalMs }) {
  const cfg = getGuild(guildId);
  const id = cfg.nextId++;
  const job = {
    id,
    channelId,
    message: String(message || '').slice(0, 2000),
    intervalMs: Math.max(60000, Number(intervalMs) || 60000),
    enabled: true,
  };
  cfg.jobs.push(job);
  persist();
  return job;
}

function removeJob(guildId, id) {
  const cfg = getGuild(guildId);
  const before = cfg.jobs.length;
  cfg.jobs = cfg.jobs.filter(j => j.id !== Number(id));
  const removed = cfg.jobs.length !== before;
  if (removed) persist();
  return removed;
}

function setEnabled(guildId, id, enabled) {
  const cfg = getGuild(guildId);
  const job = cfg.jobs.find(j => j.id === Number(id));
  if (!job) return null;
  job.enabled = !!enabled;
  persist();
  return job;
}

module.exports = {
  listJobs,
  addJob,
  removeJob,
  setEnabled,
  getGuild,
};

