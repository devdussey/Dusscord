const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'joinlog_config.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    cache = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile, 'utf8')) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function save() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(cache, null, 2), 'utf8');
}

function setConfig(guildId, cfg) {
  const s = load();
  s[guildId] = { ...(s[guildId] || {}), ...cfg };
  save();
}

function getConfig(guildId) {
  const s = load();
  return s[guildId] || null;
}

function clearConfig(guildId) {
  const s = load();
  delete s[guildId];
  save();
}

module.exports = { setConfig, getConfig, clearConfig };

