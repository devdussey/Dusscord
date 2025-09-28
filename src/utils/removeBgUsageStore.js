const { ensureFileSync, readJsonSync, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'removebg-usage.json';
let cache = null;

function load() {
  if (!cache) {
    ensureFileSync(STORE_FILE, {});
    cache = readJsonSync(STORE_FILE, {}) || {};
    cleanupIfNeeded();
  }
  return cache;
}

function save() {
  if (!cache) return;
  writeJsonSync(STORE_FILE, cache);
}

function todayKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function cleanupIfNeeded() {
  if (!cache) return;
  const validDate = todayKey();
  let changed = false;
  for (const [userId, entry] of Object.entries(cache)) {
    if (!entry || entry.date !== validDate) {
      cache[userId] = { date: validDate, count: 0 };
      changed = true;
    }
  }
  if (changed) save();
}

function getEntry(userId) {
  if (!userId) return { date: todayKey(), count: 0 };
  const data = load();
  const id = String(userId);
  const currentDate = todayKey();
  let entry = data[id];
  if (!entry || entry.date !== currentDate) {
    entry = { date: currentDate, count: 0 };
    data[id] = entry;
    save();
  }
  return entry;
}

function tryConsume(userId, limit) {
  if (!userId) {
    return { allowed: false, remaining: 0, used: 0 };
  }
  const entry = getEntry(userId);
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, used: entry.count };
  }
  entry.count += 1;
  save();
  return { allowed: true, remaining: Math.max(0, limit - entry.count), used: entry.count };
}

function getUsage(userId, limit) {
  const entry = getEntry(userId);
  return {
    remaining: Math.max(0, limit - entry.count),
    used: entry.count,
    limit,
  };
}

module.exports = {
  tryConsume,
  getUsage,
};
