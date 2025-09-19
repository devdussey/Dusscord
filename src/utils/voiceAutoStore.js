const fs = require('fs').promises;
const { ensureFile, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = 'voice_auto.json';
const DEFAULT_STORE = { guilds: {} };

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    await ensureFile(STORE_FILE, DEFAULT_STORE);
    const file = resolveDataPath(STORE_FILE);
    const raw = await fs.readFile(file, 'utf8').catch(err => {
      if (err?.code === 'ENOENT') return '';
      throw err;
    });
    const parsed = raw ? JSON.parse(raw) : { ...DEFAULT_STORE };
    if (!parsed.guilds || typeof parsed.guilds !== 'object') parsed.guilds = {};
    cache = parsed;
  } catch (err) {
    console.error('Failed to load voice auto store:', err);
    cache = { ...DEFAULT_STORE };
  }
  return cache;
}

function normaliseChannels(channels) {
  if (!Array.isArray(channels)) return [];
  const seen = new Set();
  const result = [];
  for (const id of channels) {
    const str = String(id);
    if (!seen.has(str) && str) {
      seen.add(str);
      result.push(str);
    }
  }
  return result;
}

async function ensureGuild(guildId) {
  const store = await load();
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') {
    store.guilds[guildId] = { channels: [] };
  }
  const guild = store.guilds[guildId];
  guild.channels = normaliseChannels(guild.channels);
  return guild;
}

async function save() {
  if (!cache) return;
  const safe = { guilds: {} };
  for (const [gid, data] of Object.entries(cache.guilds || {})) {
    const channels = normaliseChannels(data?.channels);
    if (channels.length) {
      safe.guilds[gid] = { channels };
    }
  }
  cache = safe;
  await writeJson(STORE_FILE, safe);
}

async function isChannelEnabled(guildId, channelId) {
  if (!guildId || !channelId) return false;
  const guild = await ensureGuild(guildId);
  return guild.channels.includes(String(channelId));
}

async function listChannels(guildId) {
  if (!guildId) return [];
  const guild = await ensureGuild(guildId);
  return [...guild.channels];
}

async function enableChannel(guildId, channelId) {
  if (!guildId || !channelId) return false;
  const guild = await ensureGuild(guildId);
  const cid = String(channelId);
  if (guild.channels.includes(cid)) return false;
  guild.channels.push(cid);
  await save();
  return true;
}

async function disableChannel(guildId, channelId) {
  if (!guildId || !channelId) return false;
  const guild = await ensureGuild(guildId);
  const cid = String(channelId);
  const before = guild.channels.length;
  guild.channels = guild.channels.filter(id => id !== cid);
  await save();
  return guild.channels.length !== before;
}

async function clearGuild(guildId) {
  if (!guildId) return false;
  await ensureGuild(guildId);
  const had = cache?.guilds?.[guildId]?.channels?.length > 0;
  if (cache?.guilds) delete cache.guilds[guildId];
  await save();
  return had;
}

module.exports = {
  isChannelEnabled,
  listChannels,
  enableChannel,
  disableChannel,
  clearGuild,
};
