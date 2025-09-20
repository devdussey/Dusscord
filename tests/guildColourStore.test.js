const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dusscord-guild-colour-'));
process.env.DUSSCORD_DATA_DIR = tempDir;

const modulePath = require.resolve('../src/utils/guildColourStore');
delete require.cache[modulePath];
const {
  setDefaultColour,
  getDefaultColour,
  parseColour,
} = require(modulePath);

test('setDefaultColour accepts hex string input', async () => {
  const saved = await setDefaultColour('guild-hex', '#1a2b3c');
  assert.strictEqual(saved, parseColour('#1a2b3c'));
  assert.strictEqual(getDefaultColour('guild-hex'), parseColour('#1a2b3c'));
});

test('setDefaultColour accepts numeric input', async () => {
  const value = parseColour('#654321');
  const saved = await setDefaultColour('guild-number', value);
  assert.strictEqual(saved, value);
  assert.strictEqual(getDefaultColour('guild-number'), value);
});
