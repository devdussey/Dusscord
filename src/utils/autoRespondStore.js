const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'autorespond.json';
const dataFile = resolveDataPath(STORE_FILE);

let cache = null;

function ensureLoaded() {
  if (cache) return;
  try {
    ensureFileSync(STORE_FILE, '{}');
    const raw = fs.readFileSync(dataFile, 'utf8');
    cache = raw ? JSON.parse(raw) : {};
    if (!cache || typeof cache !== 'object') cache = {};
  } catch (err) {
    console.error('Failed to load autorespond store:', err);
    cache = {};
  }
}

function persist() {
  const safe = cache && typeof cache === 'object' ? cache : {};
  writeJsonSync(STORE_FILE, safe);
}

function getGuildConfig(guildId) {
  ensureLoaded();
  if (!cache[guildId]) {
    cache[guildId] = { enabled: false, nextId: 1, rules: [] };
    persist();
  }
  const cfg = cache[guildId];
  if (typeof cfg.enabled !== 'boolean') cfg.enabled = false;
  if (!Array.isArray(cfg.rules)) cfg.rules = [];
  if (!cfg.nextId || typeof cfg.nextId !== 'number') cfg.nextId = 1;
  return cfg;
}

function setEnabled(guildId, enabled) {
  const cfg = getGuildConfig(guildId);
  cfg.enabled = !!enabled;
  persist();
  return cfg.enabled;
}

function listRules(guildId) {
  const cfg = getGuildConfig(guildId);
  return cfg.rules.slice();
}

function addRule(guildId, rule) {
  const cfg = getGuildConfig(guildId);
  const id = cfg.nextId++;
  const cleaned = {
    id,
    trigger: String(rule.trigger || '').slice(0, 300),
    reply: String(rule.reply || '').slice(0, 2000),
    match: (rule.match || 'contains'),
    caseSensitive: !!rule.caseSensitive,
    channelId: rule.channelId || null,
  };
  cfg.rules.push(cleaned);
  persist();
  return cleaned;
}

function removeRule(guildId, id) {
  const cfg = getGuildConfig(guildId);
  const before = cfg.rules.length;
  cfg.rules = cfg.rules.filter(r => r.id !== Number(id));
  const removed = cfg.rules.length !== before;
  if (removed) persist();
  return removed;
}

module.exports = {
  getGuildConfig,
  setEnabled,
  listRules,
  addRule,
  removeRule,
};

