const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'joinlog_config.json';

function getDataFile() {
  return resolveDataPath(STORE_FILE);
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    ensureFileSync(STORE_FILE, {});
    const filePath = getDataFile();
    cache = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8') || '{}') : {};
  } catch (err) {
    console.error('Failed to load join log config store:', err);
    cache = {};
  }
  return cache;
}

function save() {
  const safe = cache && typeof cache === 'object' ? cache : {};
  writeJsonSync(STORE_FILE, safe);
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

