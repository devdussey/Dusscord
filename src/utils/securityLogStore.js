const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'securitylog.json');

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

function get(guildId) {
  ensureLoaded();
  return cache[guildId] || null;
}

function set(guildId, channelId) {
  ensureLoaded();
  cache[guildId] = channelId;
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(cache, null, 2), 'utf8');
}

function clear(guildId) {
  ensureLoaded();
  delete cache[guildId];
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(cache, null, 2), 'utf8');
}

module.exports = { get, set, clear };

