const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'streamlogs.json');

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
};

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
    console.error('Failed to write stream log store:', err);
  }
}

async function ensureGuild(guildId) {
  await ensureLoaded();
  if (!cache[guildId]) cache[guildId] = { channelId: null, categories: { ...DEFAULT_CATEGORIES } };
  if (!cache[guildId].categories) cache[guildId].categories = { ...DEFAULT_CATEGORIES, ...(cache[guildId].categories || {}) };
  return cache[guildId];
}

async function setChannel(guildId, channelId) {
  const g = await ensureGuild(guildId);
  g.channelId = channelId || null;
  await persist();
}

async function getChannel(guildId) {
  const g = await ensureGuild(guildId);
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
  return { channelId: g.channelId || null, categories: { ...g.categories } };
}

module.exports = {
  DEFAULT_CATEGORIES,
  setChannel,
  getChannel,
  setEnabled,
  getEnabled,
  listStatuses,
};

