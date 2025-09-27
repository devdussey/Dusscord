const { ensureFileSync, readJsonSync, writeJson } = require('./dataDir');

const STORE_FILE = 'analysis_config.json';
const MAX_PERSONA_LENGTH = 2000;

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
    console.error('Failed to load analysis config store', err);
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

function ensureGuildRecord(guildId) {
  const store = loadStore();
  if (!guildId) return { persona: null, updatedAt: null, judgement: { users: {} } };
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') {
    store.guilds[guildId] = { persona: null, updatedAt: null, judgement: { users: {} } };
  }
  const guild = store.guilds[guildId];
  if (!guild.judgement || typeof guild.judgement !== 'object') guild.judgement = { users: {} };
  if (!guild.judgement.users || typeof guild.judgement.users !== 'object') guild.judgement.users = {};
  return guild;
}

function ensureUserRecord(guildId, userId) {
  if (!guildId || !userId) return { tokens: 0 };
  const guild = ensureGuildRecord(guildId);
  if (!guild.judgement.users[userId] || typeof guild.judgement.users[userId] !== 'object') {
    guild.judgement.users[userId] = { tokens: 0, updatedAt: null };
  }
  const user = guild.judgement.users[userId];
  if (!Number.isFinite(user.tokens) || user.tokens < 0) user.tokens = 0;
  return user;
}

function getPersona(guildId) {
  if (!guildId) return null;
  const guild = ensureGuildRecord(guildId);
  const persona = guild.persona;
  if (typeof persona === 'string' && persona.trim()) {
    return persona;
  }
  return null;
}

async function setPersona(guildId, text) {
  if (!guildId) throw new Error('Guild ID is required.');
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) throw new Error('Persona text cannot be empty.');
  if (raw.length > MAX_PERSONA_LENGTH) {
    throw new Error(`Persona text must be at most ${MAX_PERSONA_LENGTH} characters.`);
  }
  const guild = ensureGuildRecord(guildId);
  guild.persona = raw;
  guild.updatedAt = new Date().toISOString();
  await saveStore();
  return guild.persona;
}

async function clearPersona(guildId) {
  if (!guildId) return false;
  const guild = ensureGuildRecord(guildId);
  if (!guild.persona) return false;
  guild.persona = null;
  guild.updatedAt = new Date().toISOString();
  await saveStore();
  return true;
}

function getJudgementBalance(guildId, userId) {
  if (!guildId || !userId) return 0;
  const record = ensureUserRecord(guildId, userId);
  return record.tokens;
}

async function addJudgementTokens(guildId, userId, amount = 1) {
  if (!guildId || !userId) return 0;
  const value = Number(amount) || 0;
  if (value <= 0) return getJudgementBalance(guildId, userId);
  const record = ensureUserRecord(guildId, userId);
  record.tokens += value;
  record.updatedAt = new Date().toISOString();
  await saveStore();
  return record.tokens;
}

async function consumeJudgementToken(guildId, userId) {
  if (!guildId || !userId) return false;
  const record = ensureUserRecord(guildId, userId);
  if (record.tokens <= 0) return false;
  record.tokens -= 1;
  record.updatedAt = new Date().toISOString();
  await saveStore();
  return true;
}

async function refundJudgementToken(guildId, userId) {
  if (!guildId || !userId) return 0;
  const record = ensureUserRecord(guildId, userId);
  record.tokens += 1;
  record.updatedAt = new Date().toISOString();
  await saveStore();
  return record.tokens;
}

function clearCache() {
  cache = null;
}

module.exports = {
  MAX_PERSONA_LENGTH,
  getPersona,
  setPersona,
  clearPersona,
  getJudgementBalance,
  addJudgementTokens,
  consumeJudgementToken,
  refundJudgementToken,
  clearCache,
};
