const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'verification.json';
const dataFile = resolveDataPath(STORE_FILE);

let cache = null;

function ensureLoaded() {
  if (cache) return;
  try {
    ensureFileSync(STORE_FILE, {});
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf8');
      cache = raw ? JSON.parse(raw) : {};
    } else {
      cache = {};
    }
  } catch (err) {
    console.error('Failed to load verification store:', err);
    cache = {};
  }
}

function persist() {
  const safe = cache && typeof cache === 'object' ? cache : {};
  writeJsonSync(STORE_FILE, safe);
}

function get(guildId) {
  ensureLoaded();
  return cache[guildId] || null;
}

function set(guildId, cfg) {
  ensureLoaded();
  cache[guildId] = { ...cfg };
  persist();
  return cache[guildId];
}

function clear(guildId) {
  ensureLoaded();
  const existed = !!cache[guildId];
  delete cache[guildId];
  persist();
  return existed;
}

module.exports = { get, set, clear };

