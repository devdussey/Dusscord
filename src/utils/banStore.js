const fs = require('fs');
const { ensureFileSync, writeJsonSync, resolveDataPath } = require('./dataDir');

const STORE_FILE = 'bans.json';

let cache = null;

function load() {
  if (cache) return cache;
  try {
    ensureFileSync(STORE_FILE, { guilds: {} });
    const file = resolveDataPath(STORE_FILE);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8');
      cache = raw ? JSON.parse(raw) : { guilds: {} };
    } else {
      cache = { guilds: {} };
    }
  } catch (err) {
    console.error('Failed to load ban store:', err);
    cache = { guilds: {} };
  }
  if (!cache.guilds || typeof cache.guilds !== 'object') cache.guilds = {};
  return cache;
}

function save() {
  if (!cache || typeof cache !== 'object') cache = { guilds: {} };
  if (!cache.guilds || typeof cache.guilds !== 'object') cache.guilds = {};
  writeJsonSync(STORE_FILE, cache);
}

function setGuildBans(guildId, guildName, bans) {
  const store = load();
  const now = Date.now();
  const entries = {};
  for (const ban of bans) {
    if (!ban || !ban.userId) continue;
    entries[ban.userId] = {
      userId: ban.userId,
      reason: ban.reason || null,
      tag: ban.tag || null,
      syncedAt: now,
    };
  }
  store.guilds[guildId] = {
    guildId,
    guildName: guildName || null,
    syncedAt: now,
    bans: entries,
  };
  save();
}

function getGuildBans(guildId) {
  const store = load();
  const guild = store.guilds?.[guildId];
  if (!guild || !guild.bans) return [];
  return Object.values(guild.bans).map(entry => ({
    userId: entry.userId,
    reason: entry.reason || null,
    tag: entry.tag || null,
    syncedAt: entry.syncedAt || guild.syncedAt || null,
  }));
}

function getUserBans(userId, { excludeGuildId } = {}) {
  const store = load();
  const results = [];
  if (!store.guilds || typeof store.guilds !== 'object') return results;
  for (const [guildId, data] of Object.entries(store.guilds)) {
    if (!data || typeof data !== 'object') continue;
    if (excludeGuildId && guildId === excludeGuildId) continue;
    const entry = data.bans?.[userId];
    if (!entry) continue;
    results.push({
      guildId,
      guildName: data.guildName || guildId,
      reason: entry.reason || null,
      tag: entry.tag || null,
      syncedAt: entry.syncedAt || data.syncedAt || null,
    });
  }
  results.sort((a, b) => (b.syncedAt || 0) - (a.syncedAt || 0));
  return results;
}

module.exports = {
  setGuildBans,
  getGuildBans,
  getUserBans,
};
