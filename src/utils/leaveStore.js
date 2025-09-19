const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'leave.json';
const file = resolveDataPath(STORE_FILE);

let cache = null;

function ensure() {
  try {
    ensureFileSync(STORE_FILE, {});
  } catch (_) {}
}

function load() {
  if (cache) return cache;
  ensure();
  try {
    cache = JSON.parse(fs.readFileSync(file, 'utf8')) || {};
  } catch {
    cache = {};
  }
  return cache;
}

function save() {
  ensure();
  const safe = cache && typeof cache === 'object' ? cache : {};
  writeJsonSync(STORE_FILE, safe);
}

function get(guildId) {
  const store = load();
  return store[guildId] || null;
}

function set(guildId, value) {
  const store = load();
  store[guildId] = value;
  save();
  return store[guildId];
}

function clear(guildId) {
  const store = load();
  const existed = !!store[guildId];
  delete store[guildId];
  save();
  return existed;
}

module.exports = { get, set, clear };
