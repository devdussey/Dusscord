const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE = resolveDataPath('user_messages.json');
const MAX_PER_USER = 1000;

let cache = null;

function ensureStoreFile() {
  try {
    ensureFileSync('user_messages.json', { guilds: {} });
  } catch (err) {
    console.error('Failed to initialise user message log store', err);
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
  await writeJson('user_messages.json', safe);
}

function ensureGuildUser(guildId, userId) {
  const store = loadStore();
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') {
    store.guilds[guildId] = { users: {} };
  }
  const guild = store.guilds[guildId];
  if (!guild.users || typeof guild.users !== 'object') guild.users = {};
  if (!Array.isArray(guild.users[userId])) {
    guild.users[userId] = [];
  }
  return guild.users[userId];
}

function sanitizeContent(content) {
  if (!content) return '';
  return String(content)
    .replace(/<@!(\d+)>/g, '[@$1]')
    .replace(/<@(\d+)>/g, '[@$1]')
    .replace(/<@&(\d+)>/g, '[@role:$1]')
    .replace(/<#(\d+)>/g, '[#channel:$1]');
}

function buildEntryFromMessage(message) {
  if (!message) return null;
  const contentRaw = message?.content || '';
  let cleaned = sanitizeContent(contentRaw).slice(0, 1900);
  if (!cleaned) {
    const attachments = [];
    if (message?.attachments?.size) {
      for (const att of message.attachments.values()) {
        if (!att) continue;
        if (att.name) attachments.push(att.name);
        else if (att.id) attachments.push(`attachment-${att.id}`);
        else attachments.push('attachment');
        if (attachments.length >= 3) break;
      }
    }
    if (!attachments.length && Array.isArray(message?.attachments)) {
      for (const att of message.attachments) {
        if (!att) continue;
        if (att.name) attachments.push(att.name);
        else attachments.push('attachment');
        if (attachments.length >= 3) break;
      }
    }
    if (attachments.length) {
      cleaned = `Attachments: ${attachments.join(', ')}`;
    }
  }

  return {
    id: message?.id || null,
    channelId: message?.channelId || null,
    content: cleaned,
    createdTimestamp: Number.isFinite(message?.createdTimestamp)
      ? Number(message.createdTimestamp)
      : Date.now(),
  };
}

function trimList(list) {
  if (Array.isArray(list) && list.length > MAX_PER_USER) {
    list.splice(0, list.length - MAX_PER_USER);
  }
}

async function recordMessage(guildId, userId, message) {
  if (!guildId || !userId) return;
  const entry = buildEntryFromMessage(message);
  if (!entry) return;

  const list = ensureGuildUser(guildId, userId);
  list.push(entry);
  trimList(list);
  await saveStore();
}

async function recordMessagesBulk(guildId, userId, messages) {
  if (!guildId || !userId) return { added: 0 };
  if (!Array.isArray(messages) || !messages.length) return { added: 0 };

  const entries = messages
    .map((message) => buildEntryFromMessage(message))
    .filter((entry) => entry && typeof entry === 'object');
  if (!entries.length) return { added: 0 };

  entries.sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0));

  const list = ensureGuildUser(guildId, userId);
  for (const entry of entries) {
    list.push(entry);
  }
  trimList(list);
  await saveStore();

  return { added: entries.length, total: list.length };
}

function getRecentMessages(guildId, userId, limit = MAX_PER_USER) {
  if (!guildId || !userId) return [];
  const list = ensureGuildUser(guildId, userId);
  if (!Array.isArray(list) || !list.length) return [];
  const count = Math.min(MAX_PER_USER, Math.max(0, Number(limit) || 0));
  const slice = list.slice(-count);
  return slice.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

module.exports = {
  MAX_PER_USER,
  recordMessage,
  getRecentMessages,
  recordMessagesBulk,
};
