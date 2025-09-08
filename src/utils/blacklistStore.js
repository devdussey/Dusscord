const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'blacklist.json');

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
        console.error('Failed to create blacklist store file:', e);
      }
    } else {
      console.error('Failed to access blacklist store:', err);
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
      await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
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
