const baseLower = 'abcdefghijklmnopqrstuvwxyz';
const baseUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const baseDigits = '0123456789';

function createSequentialFont(key, label, codepoints) {
  const mapping = {};

  if (typeof codepoints.lowerStart === 'number') {
    for (let i = 0; i < baseLower.length; i += 1) {
      mapping[baseLower[i]] = String.fromCodePoint(codepoints.lowerStart + i);
    }
  }

  if (typeof codepoints.upperStart === 'number') {
    for (let i = 0; i < baseUpper.length; i += 1) {
      mapping[baseUpper[i]] = String.fromCodePoint(codepoints.upperStart + i);
    }
  }

  if (typeof codepoints.digitStart === 'number') {
    for (let i = 0; i < baseDigits.length; i += 1) {
      mapping[baseDigits[i]] = String.fromCodePoint(codepoints.digitStart + i);
    }
  }

  return {
    key,
    label,
    mapping,
  };
}

const fonts = [
  createSequentialFont('bold', 'Mathematical Bold', {
    upperStart: 0x1d400,
    lowerStart: 0x1d41a,
    digitStart: 0x1d7ce,
  }),
  createSequentialFont('italic', 'Mathematical Italic', {
    upperStart: 0x1d434,
    lowerStart: 0x1d44e,
  }),
  createSequentialFont('bold_italic', 'Mathematical Bold Italic', {
    upperStart: 0x1d468,
    lowerStart: 0x1d482,
  }),
  createSequentialFont('sans_serif', 'Mathematical Sans-Serif', {
    upperStart: 0x1d5a0,
    lowerStart: 0x1d5ba,
    digitStart: 0x1d7e2,
  }),
  createSequentialFont('sans_serif_bold', 'Mathematical Sans-Serif Bold', {
    upperStart: 0x1d5d4,
    lowerStart: 0x1d5ee,
    digitStart: 0x1d7ec,
  }),
  createSequentialFont('monospace', 'Mathematical Monospace', {
    upperStart: 0x1d670,
    lowerStart: 0x1d68a,
    digitStart: 0x1d7f6,
  }),
];

const fontMap = new Map(fonts.map(font => [font.key, font]));

function transformWithFont(text, fontKey) {
  const font = fontMap.get(fontKey);
  if (!font) {
    throw new Error(`Unknown font: ${fontKey}`);
  }

  const { mapping } = font;
  return Array.from(text).map(char => mapping[char] ?? char).join('');
}

const fontChoices = fonts.map(font => ({ name: font.label, value: font.key }));

module.exports = {
  fonts,
  fontChoices,
  transformWithFont,
};
