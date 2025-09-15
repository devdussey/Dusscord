const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const modulePath = require.resolve('../src/utils/serverTagStore');

async function withTempStore(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'servertag-'));
  delete require.cache[modulePath];
  process.env.DUSSCORD_DATA_DIR = tmpDir;
  const store = require(modulePath);
  try {
    await fn(store, tmpDir);
  } finally {
    delete require.cache[modulePath];
    delete process.env.DUSSCORD_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('server tag store set/get/clear cycle', async () => {
  await withTempStore(async store => {
    assert.equal(store.getServerTag('123'), null);
    const saved = await store.setServerTag('123', 'My Server');
    assert.equal(saved, 'My Server');
    assert.equal(store.getServerTag('123'), 'My Server');
    const file = path.join(process.env.DUSSCORD_DATA_DIR, 'server_tags.json');
    assert.ok(fs.existsSync(file));
    const removed = await store.clearServerTag('123');
    assert.equal(removed, true);
    assert.equal(store.getServerTag('123'), null);
    const removedAgain = await store.clearServerTag('123');
    assert.equal(removedAgain, false);
  });
});

test('server tag validation trims and limits length', async () => {
  await withTempStore(async store => {
    await assert.rejects(() => store.setServerTag('1', '   '), /cannot be empty/i);
    const max = store.MAX_TAG_LENGTH;
    await assert.rejects(() => store.setServerTag('1', 'a'.repeat(max + 1)), /at most/);
    const saved = await store.setServerTag('1', '  Hello World  ');
    assert.equal(saved, 'Hello World');
    assert.equal(store.getServerTag('1'), 'Hello World');
  });
});
