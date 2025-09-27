const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const modulePath = require.resolve('../src/utils/coinStore');
const { resetDataDirCache } = require('../src/utils/dataDir');
const { getPrayCooldownMs } = require('../src/utils/economyConfig');

async function withTempStore(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coins-'));
  delete require.cache[modulePath];
  process.env.DUSSCORD_DATA_DIR = tmpDir;
  resetDataDirCache();
  const store = require(modulePath);
  try {
    await fn(store, tmpDir);
  } finally {
    delete require.cache[modulePath];
    resetDataDirCache();
    delete process.env.DUSSCORD_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('new users start with base coins and support add/spend', async () => {
  await withTempStore(async store => {
    const guildId = 'guild';
    const userId = 'user';

    assert.equal(store.getBalance(guildId, userId), 50);

    await store.addCoins(guildId, userId, 12.5);
    assert.equal(store.getBalance(guildId, userId), 62.5);

    const spent = await store.spendCoins(guildId, userId, 20);
    assert.equal(spent, true);
    assert.equal(store.getBalance(guildId, userId), 42.5);

    const failed = await store.spendCoins(guildId, userId, 1_000);
    assert.equal(failed, false);
    assert.equal(store.getBalance(guildId, userId), 42.5);

    const file = path.join(process.env.DUSSCORD_DATA_DIR, 'coins.json');
    assert.ok(fs.existsSync(file));
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.guilds[guildId].users[userId].coins, 42.5);
  });
});

test('daily prayer applies reward and enforces cooldown', async () => {
  await withTempStore(async store => {
    const guildId = 'guild';
    const userId = 'user';
    const now = Date.now();

    const statusBefore = store.getPrayStatus(guildId, userId, now);
    assert.equal(statusBefore.canPray, true);

    const result = await store.recordPrayer(guildId, userId, 25, now);
    assert.equal(result.balance, 75);

    const shortlyAfter = store.getPrayStatus(guildId, userId, now + 1_000);
    assert.equal(shortlyAfter.canPray, false);
    assert(shortlyAfter.cooldownMs > 0);

    const afterCooldown = store.getPrayStatus(guildId, userId, now + getPrayCooldownMs() + 1);
    assert.equal(afterCooldown.canPray, true);
  });
});
