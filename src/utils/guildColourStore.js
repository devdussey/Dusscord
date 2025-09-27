const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJson } = require('./dataDir');

// Fallback default embed color (24-bit integer, no alpha)
const DEFAULT_EMBED_COLOUR = 0xf10909;

const STORE_FILE_NAME = 'embed_colours.json';

function getStoreFilePath() {
  return resolveDataPath(STORE_FILE_NAME);
}

function ensureStore() {
  try {
    ensureFileSync(STORE_FILE_NAME, { guilds: {} });
  } catch (err) {
    console.error('Failed to ensure guild colour store:', err);
    // best-effort; read/write calls will handle errors
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(getStoreFilePath(), 'utf8');
    const json = JSON.parse(raw);
    return json && typeof json === 'object' && json.guilds ? json : { guilds: {} };
  } catch {
    return { guilds: {} };
  }
}

async function writeStore(store) {
  ensureStore();
  await writeJson(STORE_FILE_NAME, store);
}

function parseColour(input) {
  if (input == null) throw new Error('No colour provided');
  const s = String(input).trim().toLowerCase();
  if (s === 'reset' || s === 'none' || s === 'default') return null;
  const mShortOrLong = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  const m0x = s.match(/^0x([0-9a-f]{6})$/i);
  let hex = null;
  if (mShortOrLong) {
    hex = mShortOrLong[1];
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  } else if (m0x) {
    hex = m0x[1];
  } else {
    throw new Error("Invalid colour. Use #RGB, #RRGGBB, 0xRRGGBB, or 'reset'.");
  }
  return parseInt(hex, 16);
}

function toHex6(colourNum) {
  return `#${Number(colourNum).toString(16).padStart(6, '0').toUpperCase()}`;
}

function getDefaultColour(guildId) {
  const store = readStore();
  const rec = store.guilds[guildId];
  if (!rec || typeof rec.colour !== 'number') return DEFAULT_EMBED_COLOUR;
  return rec.colour;
}

async function setDefaultColour(guildId, input) {
  let parsed;
  if (input === null) {
    parsed = null;
  } else if (typeof input === 'number') {
    if (!Number.isInteger(input) || input < 0 || input > 0xffffff) {
      throw new Error("Invalid colour number. Use values between 0x000000 and 0xFFFFFF.");
    }
    parsed = input;
  } else {
    parsed = parseColour(input);
  }
  const store = readStore();
  if (!store.guilds[guildId]) store.guilds[guildId] = {};
  if (parsed == null) delete store.guilds[guildId].colour; else store.guilds[guildId].colour = parsed;
  await writeStore(store);
  return parsed; // null means reset
}

function applyDefaultColour(embed, guildId) {
  const colour = getDefaultColour(guildId);
  return embed.setColor(colour);
}

module.exports = {
  DEFAULT_EMBED_COLOUR,
  parseColour,
  toHex6,
  getDefaultColour,
  setDefaultColour,
  applyDefaultColour,
};
