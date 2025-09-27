const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = resolveDataPath('judgements.json');

let cache = null;

function ensureStoreFile() {
  try {
    ensureFileSync('judgements.json', { guilds: {} });
  } catch (err) {
    console.error('Failed to initialise judgement store', err);
  }
}

function loadStore() {
  if (cache) return cache;
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      cache = { guilds: {} };
    } else {
      if (!parsed.guilds || typeof parsed.guilds !== 'object') parsed.guilds = {};
      cache = parsed;
    }
  } catch (err) {
    cache = { guilds: {} };
  }
  return cache;
}

async function saveStore() {
  ensureStoreFile();
  const safe = cache && typeof cache === 'object' ? cache : { guilds: {} };
  if (!safe.guilds || typeof safe.guilds !== 'object') safe.guilds = {};
  await writeJson('judgements.json', safe);
}

function ensureRecord(guildId, userId) {
  const store = loadStore();
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') {
    store.guilds[guildId] = { users: {} };
  }
  const guild = store.guilds[guildId];
  if (!guild.users || typeof guild.users !== 'object') guild.users = {};
  if (!guild.users[userId] || typeof guild.users[userId] !== 'object') {
    guild.users[userId] = { tokens: 0 };
  }
  const rec = guild.users[userId];
  if (!Number.isFinite(rec.tokens) || rec.tokens < 0) rec.tokens = 0;
  rec.tokens = Math.floor(rec.tokens);
  return rec;
}

async function addTokens(guildId, userId, amount = 1) {
  if (!guildId || !userId) return 0;
  const num = Number(amount) || 0;
  if (num <= 0) return getBalance(guildId, userId);
  const rec = ensureRecord(guildId, userId);
  rec.tokens += num;
  await saveStore();
  return rec.tokens;
}

function getBalance(guildId, userId) {
  if (!guildId || !userId) return 0;
  const rec = ensureRecord(guildId, userId);
  return rec.tokens;
}

module.exports = {
  addTokens,
  getBalance,
};
