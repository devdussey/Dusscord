const fs = require('fs/promises');
const { ensureFile, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = 'blacklist.json';
const FILE = resolveDataPath(STORE_FILE);

let cache = null;
let saveTimeout = null;

async function ensureStoreFile() {
  try {
    await ensureFile(STORE_FILE, { guilds: {} });
  } catch (err) {
    console.error('Failed to prepare blacklist store file:', err);
  }
}

async function load() {
  if (cache) return cache;
  await ensureStoreFile();
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed.guilds || typeof parsed.guilds !== 'object') parsed.guilds = {};
    cache = parsed;
  } catch (err) {
    console.error('Failed to load blacklist store:', err);
    cache = { guilds: {} };
  }
  return cache;
}

function scheduleSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    try {
      const safe = cache && typeof cache === 'object' ? cache : { guilds: {} };
      if (!safe.guilds || typeof safe.guilds !== 'object') safe.guilds = {};
      await writeJson(STORE_FILE, safe);
    } catch (err) {
      console.error('Failed to save blacklist store:', err);
    }
  }, 100);
}

function getGuild(data, guildId) {
  if (!data.guilds[guildId]) data.guilds[guildId] = {};
  return data.guilds[guildId];
}

module.exports = {
  async add(guildId, userId, username, reason) {
    const data = await load();
    const g = getGuild(data, guildId);
    g[userId] = { username, reason };
    scheduleSave();
  },
  async remove(guildId, userId) {
    const data = await load();
    const g = getGuild(data, guildId);
    delete g[userId];
    scheduleSave();
  },
  async get(guildId, userId) {
    const data = await load();
    const g = getGuild(data, guildId);
    return g[userId] || null;
  },
  async list(guildId) {
    const data = await load();
    const g = getGuild(data, guildId);
    return Object.entries(g).map(([uid, info]) => ({ userId: uid, ...info }));
  }
};
