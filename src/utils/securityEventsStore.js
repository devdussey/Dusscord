const fs = require('fs').promises;
const { ensureFile, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = 'securityevents.json';

function getDataFile() {
  return resolveDataPath(STORE_FILE);
}
const DEFAULT_STORE = { events: [] };

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    await ensureFile(STORE_FILE, DEFAULT_STORE);
    const raw = await fs.readFile(getDataFile(), 'utf8').catch(err => {
      if (err?.code === 'ENOENT') return '';
      throw err;
    });
    cache = raw ? JSON.parse(raw) : { ...DEFAULT_STORE };
    if (!Array.isArray(cache.events)) cache.events = [];
  } catch (err) {
    console.error('Failed to load security events store:', err);
    cache = { ...DEFAULT_STORE };
  }
  return cache;
}

async function persist() {
  try {
    const safe = cache && typeof cache === 'object' ? cache : { ...DEFAULT_STORE };
    if (!Array.isArray(safe.events)) safe.events = [];
    await writeJson(STORE_FILE, safe);
  } catch (err) {
    console.error('Failed to write security events store:', err);
  }
}

async function addEvent(evt) {
  const store = await load();
  store.events.push(evt);
  // Bound file size: keep last 5000 events
  if (store.events.length > 5000) {
    store.events = store.events.slice(-5000);
  }
  await persist();
}

async function getSummary({ guildId, type, sinceMs = 7 * 24 * 60 * 60 * 1000 }) {
  const store = await load();
  const cutoff = Date.now() - sinceMs;
  const byUser = new Map();
  for (const e of store.events) {
    if (guildId && e.guildId !== guildId) continue;
    if (type && e.type !== type) continue;
    if (e.timestamp < cutoff) continue;
    const key = e.userId || 'unknown';
    const rec = byUser.get(key) || { userId: e.userId, tag: e.tag || 'Unknown', count: 0, lastAt: 0, reasons: new Set(), actions: new Set() };
    rec.count += 1;
    rec.lastAt = Math.max(rec.lastAt, e.timestamp);
    if (e.reason) rec.reasons.add(e.reason);
    if (e.action) rec.actions.add(e.action);
    if (e.tag && rec.tag === 'Unknown') rec.tag = e.tag;
    byUser.set(key, rec);
  }
  // Convert sets to arrays and sort by count desc
  const rows = Array.from(byUser.values()).map(r => ({
    userId: r.userId,
    tag: r.tag,
    count: r.count,
    lastAt: r.lastAt,
    reasons: Array.from(r.reasons).slice(0, 5),
    actions: Array.from(r.actions).slice(0, 5),
  })).sort((a, b) => b.count - a.count);
  return rows;
}

module.exports = { addEvent, getSummary };

