const fs = require('fs').promises;
const { ensureFile, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = 'streamlogs.json';

function getDataFile() {
  return resolveDataPath(STORE_FILE);
}

let cache = null;

const DEFAULT_CATEGORIES = {
  messages: false,
  invites: false,
  reactions: false,
  roles: false,
  users: false,
  server: false,
  channels: false,
  bot: false,
  verification: false,
  security: false,
};

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
    console.error('Failed to load stream log store:', err);
    cache = {};
  }
}

async function persist() {
  try {
    const safe = cache && typeof cache === 'object' ? cache : {};
    await writeJson(STORE_FILE, safe);
  } catch (err) {
    console.error('Failed to write stream log store:', err);
  }
}

async function ensureGuild(guildId) {
  await ensureLoaded();
  if (!cache[guildId]) cache[guildId] = { channelId: null, categories: { ...DEFAULT_CATEGORIES }, categoryChannels: {} };
  const g = cache[guildId];
  if (!g.categories || typeof g.categories !== 'object') g.categories = {};
  g.categories = { ...DEFAULT_CATEGORIES, ...g.categories };
  if (!g.categoryChannels || typeof g.categoryChannels !== 'object') g.categoryChannels = {};
  return g;
}

async function setChannel(guildId, channelId, category = null) {
  const g = await ensureGuild(guildId);
  if (category) {
    if (!Object.prototype.hasOwnProperty.call(g.categories, category)) throw new Error('Unknown category');
    g.categoryChannels[category] = channelId || null;
  } else {
    g.channelId = channelId || null;
  }
  await persist();
}

async function getChannel(guildId) {
  const g = await ensureGuild(guildId);
  return g.channelId || null;
}

async function getChannelForCategory(guildId, category) {
  const g = await ensureGuild(guildId);
  if (category && Object.prototype.hasOwnProperty.call(g.categories, category)) {
    const specific = g.categoryChannels?.[category];
    if (specific) return specific;
  }
  return g.channelId || null;
}

async function setEnabled(guildId, category, enabled) {
  const g = await ensureGuild(guildId);
  if (!Object.prototype.hasOwnProperty.call(g.categories, category)) throw new Error('Unknown category');
  g.categories[category] = !!enabled;
  await persist();
}

async function getEnabled(guildId, category) {
  const g = await ensureGuild(guildId);
  if (!Object.prototype.hasOwnProperty.call(g.categories, category)) return false;
  return !!g.categories[category];
}

async function listStatuses(guildId) {
  const g = await ensureGuild(guildId);
  const categories = { ...g.categories };
  const categoryChannels = {};
  for (const key of Object.keys(categories)) {
    categoryChannels[key] = g.categoryChannels?.[key] || null;
  }
  return { channelId: g.channelId || null, categories, categoryChannels };
}

module.exports = {
  DEFAULT_CATEGORIES,
  setChannel,
  getChannel,
  getChannelForCategory,
  setEnabled,
  getEnabled,
  listStatuses,
};

