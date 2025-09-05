const fs = require('fs');
const path = require('path');

// Fallback default embed color (24-bit integer, no alpha)
const DEFAULT_EMBED_COLOUR = 0xf10909;

const dataDir = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(dataDir, 'embed_colours.json');

function ensureStore() {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify({ guilds: {} }, null, 2), 'utf8');
    }
  } catch (err) { console.error('src/utils/guildColourStore.js', err);
    // best-effort; read/write calls will handle errors
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const json = JSON.parse(raw);
    return json && typeof json === 'object' && json.guilds ? json : { guilds: {} };
  } catch {
    return { guilds: {} };
  }
}

async function writeStore(store) {
  ensureStore();
  await fs.promises.writeFile(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
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
  const parsed = input === null ? null : parseColour(input);
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
