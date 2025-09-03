const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'verification.json');

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

