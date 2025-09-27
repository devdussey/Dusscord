const NAMED_COLOURS = Object.freeze({
  red: 0xff0000,
  orange: 0xffa500,
  yellow: 0xffe600,
  green: 0x57f287,
  blue: 0x5865f2,
  purple: 0x9b59b6,
  pink: 0xff69b4,
  white: 0xffffff,
  black: 0x000000,
  grey: 0x95a5a6,
  gray: 0x95a5a6,
  cyan: 0x00ffff,
  teal: 0x1abc9c,
  gold: 0xf1c40f,
});

function parseColorInput(input, fallback) {
  if (input == null) {
    return fallback;
  }

  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }

  if (typeof input !== 'string') {
    return fallback;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return fallback;
  }

  const lower = trimmed.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NAMED_COLOURS, lower)) {
    return NAMED_COLOURS[lower];
  }

  const hexMatch = lower.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      const expanded = hex.split('').map(ch => ch + ch).join('');
      return parseInt(expanded, 16);
    }
    return parseInt(hex, 16);
  }

  const intVal = Number.parseInt(trimmed, 10);
  if (Number.isFinite(intVal)) {
    return intVal;
  }

  return fallback;
}

module.exports = { parseColorInput };
