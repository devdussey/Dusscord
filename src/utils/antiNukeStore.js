const fs = require('fs').promises;
const { ensureFile, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = 'antinuke.json';
const dataFile = resolveDataPath(STORE_FILE);

let cache = null;

const DEFAULT_DETECTION = {
  enabled: true,
  threshold: 3,
  windowSec: 60,
};

const DEFAULT_CONFIG = {
  enabled: false,
  detections: {
    channelDelete: { ...DEFAULT_DETECTION },
    roleDelete: { ...DEFAULT_DETECTION },
  },
  autoJail: false,
  notifyOwners: true,
  streamAlerts: true,
  ignoreBots: true,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeNumber(value, fallback, { min = 1, max = 1000 } = {}) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.min(Math.max(num, min), max);
}

function normaliseDetection(raw) {
  const data = raw && typeof raw === 'object' ? { ...raw } : {};
  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : DEFAULT_DETECTION.enabled,
    threshold: sanitizeNumber(data.threshold, DEFAULT_DETECTION.threshold, { min: 1, max: 20 }),
    windowSec: sanitizeNumber(data.windowSec, DEFAULT_DETECTION.windowSec, { min: 10, max: 900 }),
  };
}

function normaliseConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? clone(raw) : {};
  const detections = cfg.detections && typeof cfg.detections === 'object' ? cfg.detections : {};
  return {
    enabled: typeof cfg.enabled === 'boolean' ? cfg.enabled : DEFAULT_CONFIG.enabled,
    detections: {
      channelDelete: normaliseDetection(detections.channelDelete),
      roleDelete: normaliseDetection(detections.roleDelete),
    },
    autoJail: typeof cfg.autoJail === 'boolean' ? cfg.autoJail : DEFAULT_CONFIG.autoJail,
    notifyOwners: typeof cfg.notifyOwners === 'boolean' ? cfg.notifyOwners : DEFAULT_CONFIG.notifyOwners,
    streamAlerts: typeof cfg.streamAlerts === 'boolean' ? cfg.streamAlerts : DEFAULT_CONFIG.streamAlerts,
    ignoreBots: typeof cfg.ignoreBots === 'boolean' ? cfg.ignoreBots : DEFAULT_CONFIG.ignoreBots,
  };
}

async function ensureLoaded() {
  if (cache) return;
  try {
    await ensureFile(STORE_FILE, '{}');
    const raw = await fs.readFile(dataFile, 'utf8').catch(err => {
      if (err?.code === 'ENOENT') return '{}';
      throw err;
    });
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') {
      cache = {};
    } else {
      cache = parsed;
    }
  } catch (err) {
    console.error('Failed to load anti-nuke store:', err);
    cache = {};
  }
}

async function ensureGuild(guildId) {
  await ensureLoaded();
  if (!cache[guildId]) cache[guildId] = normaliseConfig();
  cache[guildId] = normaliseConfig(cache[guildId]);
  return cache[guildId];
}

async function persist() {
  try {
    const safe = cache && typeof cache === 'object' ? cache : {};
    await writeJson(STORE_FILE, safe);
  } catch (err) {
    console.error('Failed to persist anti-nuke store:', err);
  }
}

async function getConfig(guildId) {
  const cfg = await ensureGuild(guildId);
  return clone(cfg);
}

async function setConfig(guildId, newConfig) {
  await ensureGuild(guildId);
  cache[guildId] = normaliseConfig(newConfig);
  await persist();
  return getConfig(guildId);
}

async function updateConfig(guildId, updater) {
  const current = await getConfig(guildId);
  const updated = normaliseConfig(typeof updater === 'function' ? updater(clone(current)) : updater);
  cache[guildId] = updated;
  await persist();
  return clone(updated);
}

module.exports = {
  getConfig,
  setConfig,
  updateConfig,
  DEFAULT_CONFIG,
};
