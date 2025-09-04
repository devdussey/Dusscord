const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'autorespond.json');

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

function persist() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(cache, null, 2), 'utf8');
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

