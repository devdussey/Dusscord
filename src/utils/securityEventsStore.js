const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'securityevents.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(dataFile)) {
      cache = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } else {
      cache = { events: [] };
    }
  } catch {
    cache = { events: [] };
  }
  return cache;
}

function persist() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(cache, null, 2), 'utf8');
}

function addEvent(evt) {
  const store = load();
  store.events.push(evt);
  // Bound file size: keep last 5000 events
  if (store.events.length > 5000) {
    store.events = store.events.slice(-5000);
  }
  persist();
}

function getSummary({ guildId, type, sinceMs = 7 * 24 * 60 * 60 * 1000 }) {
  const store = load();
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

