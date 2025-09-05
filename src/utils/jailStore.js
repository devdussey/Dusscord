const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'jail.json');

function ensureFile() {
  try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (err) { console.error('src/utils/jailStore.js', err); }
  if (!fs.existsSync(FILE)) {
    try { fs.writeFileSync(FILE, JSON.stringify({ guilds: {} }, null, 2)); } catch (err) { console.error('src/utils/jailStore.js', err); }
  }
}

function load() {
  ensureFile();
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed.guilds || typeof parsed.guilds !== 'object') parsed.guilds = {};
    return parsed;
  } catch (err) { console.error('src/utils/jailStore.js', err);
    return { guilds: {} };
  }
}

function save(data) {
  ensureFile();
  try { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); } catch (err) { console.error('src/utils/jailStore.js', err); }
}

function getGuild(data, guildId) {
  if (!data.guilds[guildId]) data.guilds[guildId] = { jailRoleId: null, publicDefault: true, jailed: {} };
  const g = data.guilds[guildId];
  if (typeof g.publicDefault !== 'boolean') g.publicDefault = true;
  if (!g.jailed) g.jailed = {};
  return g;
}

module.exports = {
  getConfig(guildId) {
    const data = load();
    const g = getGuild(data, guildId);
    return { jailRoleId: g.jailRoleId || null, publicDefault: g.publicDefault };
  },
  setJailRole(guildId, roleId) {
    const data = load();
    const g = getGuild(data, guildId);
    g.jailRoleId = roleId;
    save(data);
  },
  getPublicDefault(guildId) {
    const data = load();
    const g = getGuild(data, guildId);
    return g.publicDefault;
  },
  setPublicDefault(guildId, isPublic) {
    const data = load();
    const g = getGuild(data, guildId);
    g.publicDefault = !!isPublic;
    save(data);
  },
  getJailed(guildId, userId) {
    const data = load();
    const g = getGuild(data, guildId);
    return g.jailed[userId] || null;
  },
  setJailed(guildId, userId, info) {
    const data = load();
    const g = getGuild(data, guildId);
    g.jailed[userId] = info;
    save(data);
  },
  removeJailed(guildId, userId) {
    const data = load();
    const g = getGuild(data, guildId);
    delete g.jailed[userId];
    save(data);
  },
  listJailed(guildId) {
    const data = load();
    const g = getGuild(data, guildId);
    return Object.entries(g.jailed).map(([uid, info]) => ({ userId: uid, ...info }));
  }
};
