const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'securitylog.json');

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

async function ensureGuild(guildId) {
  await ensureLoaded();
  const cur = cache[guildId];
  if (cur && typeof cur === 'object') return cur;
  // Migrate string -> object
  const obj = { channelId: typeof cur === 'string' ? cur : null, mode: 'channel', enabled: true };
  cache[guildId] = obj;
  return obj;
}

async function persist() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write security log store:', err);
  }
}

async function get(guildId) {
  const g = await ensureGuild(guildId);
  return g.channelId || null;
}

async function getMode(guildId) {
  const g = await ensureGuild(guildId);
  return g.mode || 'channel';
}

async function set(guildId, channelId) {
  const g = await ensureGuild(guildId);
  g.channelId = channelId;
  await persist();
}

async function setMode(guildId, mode) {
  const g = await ensureGuild(guildId);
  g.mode = mode;
  await persist();
}

async function getEnabled(guildId) {
  const g = await ensureGuild(guildId);
  return typeof g.enabled === 'boolean' ? g.enabled : true;
}

async function setEnabled(guildId, enabled) {
  const g = await ensureGuild(guildId);
  g.enabled = !!enabled;
  await persist();
}

async function clear(guildId) {
  await ensureLoaded();
  delete cache[guildId];
  await persist();
}

module.exports = { get, set, clear, getMode, setMode, getEnabled, setEnabled };
