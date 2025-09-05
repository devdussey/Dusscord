const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'logchannels.json');

let cache = null;

async function ensureLoaded() {
  if (cache) return;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    const raw = await fs.readFile(dataFile, 'utf8');
    cache = JSON.parse(raw);
  } catch {
    cache = {};
  }
}

async function persist() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(cache, null, 2), 'utf8');
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

