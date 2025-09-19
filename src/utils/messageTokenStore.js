const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = resolveDataPath('message_tokens.json');
const AWARD_THRESHOLD = 200;

let cache = null;

function ensureStoreFile() {
  try {
    ensureFileSync('message_tokens.json', { guilds: {} });
  } catch (err) {
    console.error('Failed to initialise message token store', err);
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
  await writeJson('message_tokens.json', safe);
}

function ensureRecord(guildId, userId) {
  const store = loadStore();
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') {
    store.guilds[guildId] = { users: {} };
  }
  const guild = store.guilds[guildId];
  if (!guild.users || typeof guild.users !== 'object') guild.users = {};
  if (!guild.users[userId] || typeof guild.users[userId] !== 'object') {
    guild.users[userId] = {
      totalMessages: 0,
      progress: 0,
      tokens: 0,
    };
  }
  const rec = guild.users[userId];
  if (!Number.isFinite(rec.totalMessages)) rec.totalMessages = 0;
  if (!Number.isFinite(rec.progress) || rec.progress < 0) rec.progress = 0;
  if (!Number.isFinite(rec.tokens) || rec.tokens < 0) rec.tokens = 0;
  rec.totalMessages = Math.floor(rec.totalMessages);
  rec.progress = Math.floor(rec.progress);
  rec.tokens = Math.floor(rec.tokens);
  if (rec.progress >= AWARD_THRESHOLD) {
    const extra = Math.floor(rec.progress / AWARD_THRESHOLD);
    rec.progress -= extra * AWARD_THRESHOLD;
    rec.tokens += extra;
  }
  return rec;
}

async function incrementMessage(guildId, userId) {
  if (!guildId || !userId) return null;
  const rec = ensureRecord(guildId, userId);
  rec.totalMessages += 1;
  rec.progress += 1;
  let awarded = 0;
  while (rec.progress >= AWARD_THRESHOLD) {
    rec.progress -= AWARD_THRESHOLD;
    rec.tokens += 1;
    awarded += 1;
  }
  await saveStore();
  return {
    awarded,
    tokens: rec.tokens,
    totalMessages: rec.totalMessages,
    progress: rec.progress,
    messagesUntilNext: AWARD_THRESHOLD - rec.progress,
  };
}

async function consumeToken(guildId, userId) {
  if (!guildId || !userId) return false;
  const rec = ensureRecord(guildId, userId);
  if (rec.tokens <= 0) return false;
  rec.tokens -= 1;
  await saveStore();
  return true;
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

function getProgress(guildId, userId) {
  if (!guildId || !userId) {
    return {
      totalMessages: 0,
      tokens: 0,
      progress: 0,
      messagesUntilNext: AWARD_THRESHOLD,
    };
  }
  const rec = ensureRecord(guildId, userId);
  return {
    totalMessages: rec.totalMessages,
    tokens: rec.tokens,
    progress: rec.progress,
    messagesUntilNext: AWARD_THRESHOLD - rec.progress,
  };
}

module.exports = {
  AWARD_THRESHOLD,
  incrementMessage,
  consumeToken,
  addTokens,
  getBalance,
  getProgress,
};
