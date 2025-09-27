const fs = require('fs').promises;
const { ensureFile, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = 'logchannels.json';

function getDataFile() {
  return resolveDataPath(STORE_FILE);
}

let cache = null;

async function ensureLoaded() {
  if (cache) return;
  try {
    await ensureFile(STORE_FILE, '{}');
    const raw = await fs.readFile(getDataFile(), 'utf8').catch(err => {
      if (err?.code === 'ENOENT') return '{}';
      throw err;
    });
    cache = JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Failed to load log channels store:', err);
    cache = {};
  }
}

async function persist() {
  try {
    const safe = cache && typeof cache === 'object' ? cache : {};
    await writeJson(STORE_FILE, safe);
  } catch (err) {
    console.error('Failed to write log channels store:', err);
  }
}

async function list(guildId) {
  await ensureLoaded();
  const arr = cache[guildId];
  return Array.isArray(arr) ? arr : [];
}

async function add(guildId, channelId) {
  await ensureLoaded();
  const set = new Set(await list(guildId));
  set.add(channelId);
  cache[guildId] = Array.from(set);
  await persist();
  return true;
}

async function remove(guildId, channelId) {
  await ensureLoaded();
  const before = await list(guildId);
  const after = before.filter(id => id !== channelId);
  cache[guildId] = after;
  await persist();
  return after.length !== before.length;
}

module.exports = { list, add, remove };

