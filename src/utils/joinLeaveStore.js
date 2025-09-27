const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'joins_leaves.json';

function getDataFile() {
  return resolveDataPath(STORE_FILE);
}

let cache = null;

function load() {
  if (cache) return cache;
  try {
    ensureFileSync(STORE_FILE, { guilds: {} });
    const filePath = getDataFile();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      cache = raw ? JSON.parse(raw) : { guilds: {} };
    } else {
      cache = { guilds: {} };
    }
  } catch (err) {
    console.error('Failed to load join/leave store:', err);
    cache = { guilds: {} };
  }
  return cache;
}

function save() {
  const safe = cache && typeof cache === 'object' ? cache : { guilds: {} };
  if (!safe.guilds || typeof safe.guilds !== 'object') safe.guilds = {};
  writeJsonSync(STORE_FILE, safe);
}

function addEvent(guildId, userId, type, timestamp = Date.now(), meta = {}) {
  const store = load();
  if (!store.guilds[guildId]) store.guilds[guildId] = { users: {}, events: [] };
  const g = store.guilds[guildId];
  if (!g.users[userId]) g.users[userId] = { joins: 0, leaves: 0, lastJoinAt: null, lastLeaveAt: null };
  const u = g.users[userId];
  // Skip if this messageId already recorded (basic dedupe for backfill)
  if (meta.messageId) {
    for (let i = g.events.length - 1, scanned = 0; i >= 0 && scanned < 2000; i--, scanned++) {
      const e = g.events[i];
      if (e && e.messageId === meta.messageId) return; // duplicate
    }
  }
  if (type === 'join') {
    u.joins += 1;
    u.lastJoinAt = timestamp;
  } else if (type === 'leave') {
    u.leaves += 1;
    u.lastLeaveAt = timestamp;
  }
  g.events.push({ userId, type, timestamp, ...meta });
  if (g.events.length > 10000) g.events = g.events.slice(-10000);
  save();
}

function getUserStats(guildId, userId, sinceMs = null) {
  const store = load();
  const g = store.guilds[guildId];
  if (!g) return { joins: 0, leaves: 0, lastJoinAt: null, lastLeaveAt: null };
  if (!sinceMs) return g.users[userId] || { joins: 0, leaves: 0, lastJoinAt: null, lastLeaveAt: null };
  const cutoff = Date.now() - sinceMs;
  let joins = 0, leaves = 0, lastJoinAt = null, lastLeaveAt = null;
  for (const e of g.events) {
    if (e.userId !== userId) continue;
    if (e.timestamp < cutoff) continue;
    if (e.type === 'join') { joins++; lastJoinAt = Math.max(lastJoinAt || 0, e.timestamp); }
    if (e.type === 'leave') { leaves++; lastLeaveAt = Math.max(lastLeaveAt || 0, e.timestamp); }
  }
  return { joins, leaves, lastJoinAt, lastLeaveAt };
}

function getLeaderboard(guildId, type = 'join', sinceMs = null, limit = 10) {
  const store = load();
  const g = store.guilds[guildId];
  if (!g) return [];
  const counts = new Map();
  if (sinceMs) {
    const cutoff = Date.now() - sinceMs;
    for (const e of g.events) {
      if (e.timestamp < cutoff) continue;
      if (type !== 'both' && e.type !== type) continue;
      const rec = counts.get(e.userId) || { joins: 0, leaves: 0 };
      if (e.type === 'join') rec.joins++;
      if (e.type === 'leave') rec.leaves++;
      counts.set(e.userId, rec);
    }
  } else {
    for (const [uid, stats] of Object.entries(g.users)) {
      counts.set(uid, { joins: stats.joins, leaves: stats.leaves });
    }
  }

  const arr = Array.from(counts.entries()).map(([userId, c]) => ({ userId, joins: c.joins, leaves: c.leaves, total: c.joins + c.leaves }));
  const key = type === 'leave' ? 'leaves' : type === 'join' ? 'joins' : 'total';
  arr.sort((a, b) => (b[key] - a[key]) || (b.total - a.total));
  return arr.slice(0, limit);
}

module.exports = { addEvent, getUserStats, getLeaderboard };
