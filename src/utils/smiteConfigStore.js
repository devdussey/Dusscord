const { ensureFileSync, writeJson, readJsonSync } = require('./dataDir');

const STORE_FILE = 'smite_config.json';
let cache = null;

function ensureStore() {
  ensureFileSync(STORE_FILE, { guilds: {} });
}

function loadStore() {
  if (cache) return cache;
  ensureStore();
  try {
    const data = readJsonSync(STORE_FILE, { guilds: {} });
    if (!data || typeof data !== 'object') {
      cache = { guilds: {} };
    } else {
      if (!data.guilds || typeof data.guilds !== 'object') data.guilds = {};
      cache = data;
    }
  } catch (err) {
    console.error('Failed to load smite config store', err);
    cache = { guilds: {} };
  }
  return cache;
}

async function saveStore() {
  const store = loadStore();
  const safe = store && typeof store === 'object' ? store : { guilds: {} };
  if (!safe.guilds || typeof safe.guilds !== 'object') safe.guilds = {};
  await writeJson(STORE_FILE, safe);
}

function getGuildRecord(guildId) {
  const store = loadStore();
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') {
    store.guilds[guildId] = { enabled: true };
  }
  const guild = store.guilds[guildId];
  if (typeof guild.enabled !== 'boolean') guild.enabled = true;
  return guild;
}

function getConfig(guildId) {
  if (!guildId) {
    return { enabled: true, updatedAt: null };
  }
  const guild = getGuildRecord(guildId);
  return {
    enabled: guild.enabled !== false,
    updatedAt: guild.updatedAt ?? null,
  };
}

function isEnabled(guildId) {
  return getConfig(guildId).enabled;
}

async function setEnabled(guildId, enabled) {
  if (!guildId) {
    return { enabled: true, updatedAt: null };
  }
  const store = loadStore();
  store.guilds[guildId] = {
    enabled: !!enabled,
    updatedAt: new Date().toISOString(),
  };
  await saveStore();
  return getConfig(guildId);
}

function clearCache() {
  cache = null;
}

module.exports = {
  getConfig,
  isEnabled,
  setEnabled,
  clearCache,
};
