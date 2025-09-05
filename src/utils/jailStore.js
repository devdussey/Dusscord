const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'jail.json');

let cache = null;
let saveTimeout = null;

async function ensureFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(FILE);
  } catch (err) {
    if (err.code === 'ENOENT') {
      try {
        await fs.writeFile(FILE, JSON.stringify({ guilds: {} }, null, 2));
      } catch (e) {
        console.error('Failed to create jail store file:', e);
      }
    } else {
      console.error('Failed to access jail store:', err);
    }
  }
}

async function load() {
  if (cache) return cache;
  await ensureFile();
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed.guilds || typeof parsed.guilds !== 'object') parsed.guilds = {};
    cache = parsed;
  } catch (err) {
    console.error('Failed to load jail store:', err);
    cache = { guilds: {} };
  }
  return cache;
}

function scheduleSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(async () => {
    saveTimeout = null;
    try {
      await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
    } catch (err) {
      console.error('Failed to save jail store:', err);
    }
  }, 100);
}

function getGuild(data, guildId) {
  if (!data.guilds[guildId]) data.guilds[guildId] = { jailRoleId: null, publicDefault: true, jailed: {} };
  const g = data.guilds[guildId];
  if (typeof g.publicDefault !== 'boolean') g.publicDefault = true;
  if (!g.jailed) g.jailed = {};
  return g;
}

module.exports = {
  async getConfig(guildId) {
    const data = await load();
    const g = getGuild(data, guildId);
    return { jailRoleId: g.jailRoleId || null, publicDefault: g.publicDefault };
  },
  async setJailRole(guildId, roleId) {
    const data = await load();
    const g = getGuild(data, guildId);
    g.jailRoleId = roleId;
    scheduleSave();
  },
  async getPublicDefault(guildId) {
    const data = await load();
    const g = getGuild(data, guildId);
    return g.publicDefault;
  },
  async setPublicDefault(guildId, isPublic) {
    const data = await load();
    const g = getGuild(data, guildId);
    g.publicDefault = !!isPublic;
    scheduleSave();
  },
  async getJailed(guildId, userId) {
    const data = await load();
    const g = getGuild(data, guildId);
    return g.jailed[userId] || null;
  },
  async setJailed(guildId, userId, info) {
    const data = await load();
    const g = getGuild(data, guildId);
    g.jailed[userId] = info;
    scheduleSave();
  },
  async removeJailed(guildId, userId) {
    const data = await load();
    const g = getGuild(data, guildId);
    delete g.jailed[userId];
    scheduleSave();
  },
  async listJailed(guildId) {
    const data = await load();
    const g = getGuild(data, guildId);
    return Object.entries(g.jailed).map(([uid, info]) => ({ userId: uid, ...info }));
  }
};
