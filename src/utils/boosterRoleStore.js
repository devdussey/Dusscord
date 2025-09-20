const fs = require('fs/promises');
const { ensureFile, writeJson, resolveDataPath } = require('./dataDir');

const STORE_FILE = 'boosterRoles.json';

let cache = null;
let saveTimer = null;

async function deleteEmblemAsset(emblem) {
  if (!emblem || typeof emblem !== 'object') return;
  const file = emblem.file || emblem.path;
  if (!file) return;
  try {
    await fs.unlink(resolveDataPath(file));
  } catch (err) {
    if (!err || err.code === 'ENOENT') return;
    console.warn(`Failed to remove booster emblem asset ${file}:`, err);
  }
}

async function ensureStore() {
  try {
    await ensureFile(STORE_FILE, { guilds: {} });
  } catch (err) {
    console.error('Failed to ensure booster role store file:', err);
  }
}

async function load() {
  if (cache) return cache;
  await ensureStore();
  try {
    const raw = await fs.readFile(resolveDataPath(STORE_FILE), 'utf8');
    const parsed = raw ? JSON.parse(raw) : { guilds: {} };
    if (!parsed.guilds || typeof parsed.guilds !== 'object') parsed.guilds = {};
    cache = parsed;
  } catch (err) {
    console.error('Failed to load booster role store:', err);
    cache = { guilds: {} };
  }
  return cache;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (!cache) return;
    try {
      if (!cache.guilds || typeof cache.guilds !== 'object') cache.guilds = {};
      await writeJson(STORE_FILE, cache);
    } catch (err) {
      console.error('Failed to persist booster role store:', err);
    }
  }, 100);
}

function getGuild(data, guildId) {
  if (!data.guilds[guildId]) data.guilds[guildId] = { boosters: {}, config: {} };
  const entry = data.guilds[guildId];
  if (!entry.boosters || typeof entry.boosters !== 'object') entry.boosters = {};
  if (!entry.config || typeof entry.config !== 'object') entry.config = {};
  return entry;
}

function scheduleCleanup(guild, userId) {
  const entry = guild.boosters[userId];
  if (!entry) return;
  if (entry.roleId || entry.color || entry.emblem) return;
  delete guild.boosters[userId];
}

function normalizeEntry(guild, userId) {
  const raw = guild.boosters[userId];
  if (!raw) return null;
  if (typeof raw === 'string') {
    const entry = { roleId: raw };
    guild.boosters[userId] = entry;
    scheduleSave();
    return entry;
  }
  if (typeof raw === 'object' && raw !== null) {
    if (raw.roleId && typeof raw.roleId !== 'string') {
      raw.roleId = String(raw.roleId);
    }
    return raw;
  }
  delete guild.boosters[userId];
  scheduleSave();
  return null;
}

function ensureEntry(guild, userId) {
  const existing = normalizeEntry(guild, userId);
  if (existing) return existing;
  const created = { roleId: null };
  guild.boosters[userId] = created;
  return created;
}

module.exports = {
  async getRoleId(guildId, userId) {
    const data = await load();
    const g = getGuild(data, guildId);
    const entry = normalizeEntry(g, userId);
    return entry?.roleId || null;
  },

  async setRoleId(guildId, userId, roleId) {
    const data = await load();
    const g = getGuild(data, guildId);
    if (roleId) {
      const entry = ensureEntry(g, userId);
      entry.roleId = roleId;
    } else if (g.boosters[userId]) {
      const entry = normalizeEntry(g, userId);
      if (entry) entry.roleId = null;
      scheduleCleanup(g, userId);
    }
    scheduleSave();
  },

  async deleteRole(guildId, userId) {
    const data = await load();
    const g = getGuild(data, guildId);
    if (g.boosters[userId]) {
      const entry = normalizeEntry(g, userId);
      if (entry?.emblem) {
        await deleteEmblemAsset(entry.emblem);
      }
      delete g.boosters[userId];
      scheduleSave();
    }
  },

  async getColorConfig(guildId, userId) {
    const data = await load();
    const g = getGuild(data, guildId);
    const entry = normalizeEntry(g, userId);
    return entry?.color || null;
  },

  async setColorConfig(guildId, userId, colorConfig) {
    const data = await load();
    const g = getGuild(data, guildId);
    if (!colorConfig) {
      const entry = normalizeEntry(g, userId);
      if (entry && entry.color) {
        delete entry.color;
        scheduleCleanup(g, userId);
        scheduleSave();
      }
      return;
    }
    const entry = ensureEntry(g, userId);
    entry.color = colorConfig;
    scheduleSave();
  },

  async getEmblem(guildId, userId) {
    const data = await load();
    const g = getGuild(data, guildId);
    const entry = normalizeEntry(g, userId);
    return entry?.emblem || null;
  },

  async setEmblem(guildId, userId, emblem) {
    const data = await load();
    const g = getGuild(data, guildId);
    if (!emblem) {
      const entry = normalizeEntry(g, userId);
      if (entry && entry.emblem) {
        await deleteEmblemAsset(entry.emblem);
        delete entry.emblem;
        scheduleCleanup(g, userId);
        scheduleSave();
      }
      return;
    }
    const entry = ensureEntry(g, userId);
    if (entry.emblem && entry.emblem.file && entry.emblem.file !== emblem.file) {
      await deleteEmblemAsset(entry.emblem);
    }
    entry.emblem = emblem;
    scheduleSave();
  },

  async removeByRoleId(guildId, roleId) {
    if (!roleId) return;
    const data = await load();
    const g = getGuild(data, guildId);
    let changed = false;
    for (const [uid, raw] of Object.entries(g.boosters)) {
      const entry = normalizeEntry(g, uid);
      if (entry?.roleId === roleId) {
        if (entry.emblem) {
          await deleteEmblemAsset(entry.emblem);
        }
        delete g.boosters[uid];
        changed = true;
      }
    }
    if (changed) scheduleSave();
  },

  async listBoosters(guildId) {
    const data = await load();
    const g = getGuild(data, guildId);
    return Object.entries(g.boosters)
      .map(([userId, raw]) => {
        const entry = normalizeEntry(g, userId);
        if (!entry?.roleId) return null;
        return {
          userId,
          roleId: entry.roleId,
          color: entry.color || null,
          emblem: entry.emblem || null,
        };
      })
      .filter(Boolean);
  },

  async getGuildConfig(guildId) {
    const data = await load();
    const g = getGuild(data, guildId);
    const enabled = typeof g.config.enabled === 'boolean' ? g.config.enabled : true;
    return { enabled };
  },

  async isGuildEnabled(guildId) {
    const data = await load();
    const g = getGuild(data, guildId);
    const enabled = typeof g.config.enabled === 'boolean' ? g.config.enabled : true;
    return Boolean(enabled);
  },

  async setGuildEnabled(guildId, enabled) {
    const data = await load();
    const g = getGuild(data, guildId);
    g.config.enabled = Boolean(enabled);
    scheduleSave();
  },
};
