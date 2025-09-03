const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'modlog.json');

let cache = null;

function ensureLoaded() {
  if (cache) return;
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(dataFile)) {
      cache = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } else {
      cache = {};
    }
  } catch {
    cache = {};
  }
}

function ensureGuild(guildId) {
  ensureLoaded();
  const cur = cache[guildId];
  if (cur && typeof cur === 'object') return cur;
  const obj = { channelId: typeof cur === 'string' ? cur : null, mode: 'channel', enabled: true };
  cache[guildId] = obj;
  return obj;
}

function persist() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(cache, null, 2), 'utf8');
}

function get(guildId) { const g = ensureGuild(guildId); return g.channelId || null; }
function set(guildId, channelId) { const g = ensureGuild(guildId); g.channelId = channelId; persist(); }
function clear(guildId) { ensureLoaded(); delete cache[guildId]; persist(); }
function getMode(guildId) { const g = ensureGuild(guildId); return g.mode || 'channel'; }
function setMode(guildId, mode) { const g = ensureGuild(guildId); g.mode = mode; persist(); }
function getEnabled(guildId) { const g = ensureGuild(guildId); return typeof g.enabled === 'boolean' ? g.enabled : true; }
function setEnabled(guildId, enabled) { const g = ensureGuild(guildId); g.enabled = !!enabled; persist(); }

module.exports = { get, set, clear, getMode, setMode, getEnabled, setEnabled };

