const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJson } = require('./dataDir');

const STORE_FILE_NAME = 'server_tags.json';
const MAX_TAG_LENGTH = 32;

function getStoreFilePath() {
  return resolveDataPath(STORE_FILE_NAME);
}

function ensureStore() {
  try {
    ensureFileSync(STORE_FILE_NAME, { guilds: {} });
  } catch (err) {
    // best effort; downstream reads/writes will surface errors if needed
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(getStoreFilePath(), 'utf8');
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
  await writeJson(STORE_FILE_NAME, clean);
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
