const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const modulePath = require.resolve('../src/utils/smiteConfigStore');
const dataDirPath = require.resolve('../src/utils/dataDir');

async function withTempStore(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smite-config-'));
  delete require.cache[modulePath];
  delete require.cache[dataDirPath];
  process.env.DUSSCORD_DATA_DIR = tmpDir;
  const store = require(modulePath);
  try {
    await fn(store, tmpDir);
  } finally {
    delete require.cache[modulePath];
    delete require.cache[dataDirPath];
    if (store?.clearCache) store.clearCache();
    delete require.cache[modulePath];
    delete process.env.DUSSCORD_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('defaults to enabled when no config exists', async () => {
  await withTempStore(async store => {
    const config = store.getConfig('guild');
    assert.equal(config.enabled, true);
    assert.equal(store.isEnabled('guild'), true);
  });
});

test('setEnabled persists preference to disk', async () => {
  await withTempStore(async (store, dir) => {
    const guildId = 'guild';
    const result = await store.setEnabled(guildId, false);
    assert.equal(result.enabled, false);
    assert.equal(store.isEnabled(guildId), false);

    const file = path.join(process.env.DUSSCORD_DATA_DIR, 'smite_config.json');
    assert.ok(fs.existsSync(file));
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.guilds[guildId].enabled, false);

    // Re-require to ensure persistence
    store.clearCache();
    delete require.cache[modulePath];
    const reloaded = require(modulePath);
    assert.equal(reloaded.isEnabled(guildId), false);
  });
});
