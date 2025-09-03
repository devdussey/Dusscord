const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'logchannels.json');

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

function list(guildId) {
  ensureLoaded();
  const arr = cache[guildId];
  return Array.isArray(arr) ? arr : [];
}

function add(guildId, channelId) {
  ensureLoaded();
  const set = new Set(list(guildId));
  set.add(channelId);
  cache[guildId] = Array.from(set);
  persist();
  return true;
}

function remove(guildId, channelId) {
  ensureLoaded();
  const before = list(guildId);
  const after = before.filter(id => id !== channelId);
  cache[guildId] = after;
  persist();
  return after.length !== before.length;
}

module.exports = { list, add, remove };

