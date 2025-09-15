const fs = require('fs');
const path = require('path');

const overrideDir = (process.env.DUSSCORD_DATA_DIR || '').trim();
const dataDir = overrideDir ? path.resolve(overrideDir) : path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(dataDir, 'server_tags.json');
const MAX_TAG_LENGTH = 32;

function ensureStore() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify({ guilds: {} }, null, 2), 'utf8');
    }
  } catch (err) {
    // best effort; downstream reads/writes will surface errors if needed
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { guilds: {} };
    if (!parsed.guilds || typeof parsed.guilds !== 'object') parsed.guilds = {};
    return parsed;
  } catch {
    return { guilds: {} };
  }
}

async function writeStore(store) {
  ensureStore();
  const clean = store && typeof store === 'object' ? store : { guilds: {} };
  if (!clean.guilds || typeof clean.guilds !== 'object') clean.guilds = {};
  await fs.promises.mkdir(dataDir, { recursive: true });
  await fs.promises.writeFile(STORE_FILE, JSON.stringify(clean, null, 2), 'utf8');
}

function normaliseTag(input) {
  if (typeof input !== 'string') throw new Error('Tag must be a string.');
  const trimmed = input.trim();
  if (!trimmed.length) throw new Error('Tag cannot be empty or whitespace.');
  if (trimmed.length > MAX_TAG_LENGTH) {
    throw new Error(`Tag must be at most ${MAX_TAG_LENGTH} characters long.`);
  }
  return trimmed;
}

function getServerTag(guildId) {
  const store = readStore();
  const rec = store.guilds?.[guildId];
  if (!rec || typeof rec !== 'object') return null;
  const tag = typeof rec.tag === 'string' ? rec.tag.trim() : '';
  return tag.length ? tag : null;
}

async function setServerTag(guildId, tag) {
  const cleaned = normaliseTag(tag);
  const store = readStore();
  if (!store.guilds || typeof store.guilds !== 'object') store.guilds = {};
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') store.guilds[guildId] = {};
  store.guilds[guildId].tag = cleaned;
  await writeStore(store);
  return cleaned;
}

async function clearServerTag(guildId) {
  const store = readStore();
  if (!store.guilds || typeof store.guilds !== 'object') store.guilds = {};
  const rec = store.guilds[guildId];
  if (!rec || typeof rec !== 'object' || typeof rec.tag === 'undefined') return false;
  const hadValue = typeof rec.tag === 'string' && rec.tag.trim().length > 0;
  delete rec.tag;
  if (!Object.keys(rec).length) delete store.guilds[guildId];
  await writeStore(store);
  return hadValue;
}

module.exports = {
  MAX_TAG_LENGTH,
  getServerTag,
  setServerTag,
  clearServerTag,
};
