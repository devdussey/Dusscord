const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const file = path.join(dataDir, 'welcome.json');

let cache = null;

function ensure() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}, null, 2), 'utf8');
  } catch (err) { console.error('src/utils/welcomeStore.js', err); }
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
  fs.writeFileSync(file, JSON.stringify(cache || {}, null, 2), 'utf8');
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

