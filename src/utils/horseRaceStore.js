const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'horserace.json';
const DEFAULT_STORE = { guilds: {} };
const dataFile = resolveDataPath(STORE_FILE);

let cache = null;

function ensureLoaded() {
  if (cache) return;
  try {
    ensureFileSync(STORE_FILE, JSON.stringify(DEFAULT_STORE, null, 2));
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') {
      cache = { ...DEFAULT_STORE };
    } else {
      cache = { ...DEFAULT_STORE, ...parsed };
      if (!cache.guilds || typeof cache.guilds !== 'object') {
        cache.guilds = {};
      }
    }
  } catch (err) {
    console.error('Failed to load horse race store:', err);
    cache = { ...DEFAULT_STORE };
  }
}

function save() {
  const safe = cache && typeof cache === 'object' ? cache : { ...DEFAULT_STORE };
  writeJsonSync(STORE_FILE, safe);
}

function getGuildEntry(guildId) {
  ensureLoaded();
  if (!cache.guilds[guildId] || typeof cache.guilds[guildId] !== 'object') {
    cache.guilds[guildId] = { stats: {} };
  } else if (!cache.guilds[guildId].stats || typeof cache.guilds[guildId].stats !== 'object') {
    cache.guilds[guildId].stats = {};
  }
  return cache.guilds[guildId];
}

function getStatsForGuild(guildId) {
  const entry = getGuildEntry(guildId);
  return { ...entry.stats };
}

function recordRace(guildId, userId, placementNumber) {
  const entry = getGuildEntry(guildId);
  const stats = entry.stats[userId] && typeof entry.stats[userId] === 'object'
    ? { ...entry.stats[userId] }
    : { first: 0, second: 0, third: 0, races: 0, lastRaceAt: 0 };

  stats.races = (Number(stats.races) || 0) + 1;
  stats.lastRaceAt = Date.now();

  if (placementNumber === 1) {
    stats.first = (Number(stats.first) || 0) + 1;
  } else if (placementNumber === 2) {
    stats.second = (Number(stats.second) || 0) + 1;
  } else if (placementNumber === 3) {
    stats.third = (Number(stats.third) || 0) + 1;
  }

  entry.stats[userId] = stats;
  save();
  return { ...stats };
}

function getLeaderboard(guildId) {
  const entry = getGuildEntry(guildId);
  const statsEntries = Object.entries(entry.stats || {});
  return statsEntries
    .map(([userId, stats]) => ({
      userId,
      first: Number(stats.first) || 0,
      second: Number(stats.second) || 0,
      third: Number(stats.third) || 0,
      races: Number(stats.races) || 0,
      lastRaceAt: Number(stats.lastRaceAt) || 0,
    }))
    .sort((a, b) => {
      if (b.first !== a.first) return b.first - a.first;
      if (b.second !== a.second) return b.second - a.second;
      if (b.third !== a.third) return b.third - a.third;
      if (b.races !== a.races) return b.races - a.races;
      return b.lastRaceAt - a.lastRaceAt;
    });
}

module.exports = {
  getStatsForGuild,
  getLeaderboard,
  recordRace,
};
