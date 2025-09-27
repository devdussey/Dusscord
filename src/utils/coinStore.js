const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJson } = require('./dataDir');
const {
  getBaseCoins,
  getPrayCooldownMs,
} = require('./economyConfig');

const STORE_FILE = 'coins.json';
const MAX_DECIMALS = 2;

let cache = null;

function toFixed(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** MAX_DECIMALS;
  return Math.round(num * factor) / factor;
}

function ensureStoreFile() {
  try {
    ensureFileSync(STORE_FILE, { guilds: {} });
  } catch (err) {
    console.error('Failed to initialise coin store', err);
  }
}

function loadStore() {
  if (cache) return cache;
  ensureStoreFile();
  try {
    const raw = fs.readFileSync(resolveDataPath(STORE_FILE), 'utf8');
    const parsed = raw ? JSON.parse(raw) : null;
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
  const store = loadStore();
  const safe = store && typeof store === 'object' ? store : { guilds: {} };
  if (!safe.guilds || typeof safe.guilds !== 'object') safe.guilds = {};
  await writeJson(STORE_FILE, safe);
}

function ensureGuild(store, guildId) {
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') {
    store.guilds[guildId] = { users: {} };
  }
  const guild = store.guilds[guildId];
  if (!guild.users || typeof guild.users !== 'object') guild.users = {};
  return guild;
}

function ensureRecord(guildId, userId) {
  if (!guildId || !userId) {
    return {
      coins: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      lastPrayAt: null,
    };
  }

  const store = loadStore();
  const guild = ensureGuild(store, guildId);
  if (!guild.users[userId] || typeof guild.users[userId] !== 'object') {
    guild.users[userId] = {};
  }

  const rec = guild.users[userId];
  if (!Number.isFinite(rec.coins)) rec.coins = getBaseCoins();
  if (!Number.isFinite(rec.lifetimeEarned)) rec.lifetimeEarned = rec.coins;
  if (!Number.isFinite(rec.lifetimeSpent)) rec.lifetimeSpent = 0;
  if (rec.lastPrayAt) {
    const parsed = Date.parse(rec.lastPrayAt);
    if (!Number.isFinite(parsed)) rec.lastPrayAt = null;
  } else {
    rec.lastPrayAt = null;
  }

  rec.coins = toFixed(Math.max(0, rec.coins));
  rec.lifetimeEarned = toFixed(Math.max(0, rec.lifetimeEarned));
  rec.lifetimeSpent = toFixed(Math.max(0, rec.lifetimeSpent));

  return rec;
}

function getBalance(guildId, userId) {
  return ensureRecord(guildId, userId).coins;
}

async function addCoins(guildId, userId, amount = 0) {
  if (!guildId || !userId) return 0;
  const value = toFixed(amount);
  if (value <= 0) return getBalance(guildId, userId);
  const rec = ensureRecord(guildId, userId);
  rec.coins = toFixed(rec.coins + value);
  rec.lifetimeEarned = toFixed(rec.lifetimeEarned + value);
  await saveStore();
  return rec.coins;
}

async function spendCoins(guildId, userId, amount = 0) {
  if (!guildId || !userId) return false;
  const value = toFixed(amount);
  if (value <= 0) return true;
  const rec = ensureRecord(guildId, userId);
  if (rec.coins + 1e-6 < value) return false;
  rec.coins = toFixed(rec.coins - value);
  rec.lifetimeSpent = toFixed(rec.lifetimeSpent + value);
  await saveStore();
  return true;
}

function getSummary(guildId, userId) {
  const rec = ensureRecord(guildId, userId);
  return {
    coins: rec.coins,
    lifetimeEarned: rec.lifetimeEarned,
    lifetimeSpent: rec.lifetimeSpent,
    lastPrayAt: rec.lastPrayAt,
  };
}

function getPrayStatus(guildId, userId, now = Date.now()) {
  const rec = ensureRecord(guildId, userId);
  const cooldownMs = getPrayCooldownMs();
  const last = rec.lastPrayAt ? Date.parse(rec.lastPrayAt) : null;
  if (!Number.isFinite(last)) {
    return { canPray: true, cooldownMs: 0, nextAvailableAt: now };
  }
  const elapsed = now - last;
  if (elapsed >= cooldownMs) {
    return { canPray: true, cooldownMs: 0, nextAvailableAt: now };
  }
  const remaining = Math.max(0, cooldownMs - elapsed);
  return { canPray: false, cooldownMs: remaining, nextAvailableAt: last + cooldownMs };
}

async function recordPrayer(guildId, userId, reward, now = Date.now()) {
  if (!guildId || !userId) return { balance: 0, lastPrayAt: null };
  const rec = ensureRecord(guildId, userId);
  const value = toFixed(reward);
  if (value > 0) {
    rec.coins = toFixed(rec.coins + value);
    rec.lifetimeEarned = toFixed(rec.lifetimeEarned + value);
  }
  rec.lastPrayAt = new Date(now).toISOString();
  await saveStore();
  return { balance: rec.coins, lastPrayAt: rec.lastPrayAt };
}

module.exports = {
  addCoins,
  spendCoins,
  getBalance,
  getSummary,
  getPrayStatus,
  recordPrayer,
};
