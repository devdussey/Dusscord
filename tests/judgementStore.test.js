const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const modulePath = require.resolve('../src/utils/judgementStore');
const dataDirPath = require.resolve('../src/utils/dataDir');

async function withTempStore(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'judgement-'));
  delete require.cache[modulePath];
  delete require.cache[dataDirPath];
  process.env.DUSSCORD_DATA_DIR = tmpDir;
  const loadStore = () => {
    delete require.cache[modulePath];
    delete require.cache[dataDirPath];
    return require(modulePath);
  };
  try {
    await fn(loadStore, tmpDir);
  } finally {
    delete require.cache[modulePath];
    delete require.cache[dataDirPath];
    delete process.env.DUSSCORD_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('awards a Judgement token every 500 messages', async () => {
  await withTempStore(async loadStore => {
    const store = loadStore();
    const guildId = 'guild';
    const userId = 'user';

    for (let i = 0; i < store.AWARD_THRESHOLD - 1; i++) {
      const res = await store.incrementMessage(guildId, userId);
      assert.equal(res.awarded, 0);
      assert.equal(res.tokens, 0);
    }

    const result = await store.incrementMessage(guildId, userId);
    assert.equal(result.awarded, 1);
    assert.equal(result.tokens, 1);
    assert.equal(result.progress, 0);
    assert.equal(result.messagesUntilNext, store.AWARD_THRESHOLD);

    const stats = store.getProgress(guildId, userId);
    assert.equal(stats.tokens, 1);
    assert.equal(stats.progress, 0);
    assert.equal(stats.messagesUntilNext, store.AWARD_THRESHOLD);
  });
});

test('manual Judgement grants persist after reload', async () => {
  await withTempStore(async loadStore => {
    let store = loadStore();
    const guildId = 'guild';
    const userId = 'user';

    const balance = await store.addTokens(guildId, userId, 3);
    assert.equal(balance, 3);
    assert.equal(store.getBalance(guildId, userId), 3);

    store = loadStore();
    assert.equal(store.getBalance(guildId, userId), 3);
  });
});

test('balances survive serialization through dataDir', async () => {
  await withTempStore(async (loadStore, tmpDir) => {
    let store = loadStore();
    const guildId = 'guild';
    const userId = 'user';

    for (let i = 0; i < store.AWARD_THRESHOLD + 250; i++) {
      await store.incrementMessage(guildId, userId);
    }

    assert.equal(store.getBalance(guildId, userId), 1);

    const file = path.join(tmpDir, 'judgement_tokens.json');
    assert.ok(fs.existsSync(file));

    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.guilds[guildId].users[userId].tokens, 1);

    store = loadStore();
    const stats = store.getProgress(guildId, userId);
    assert.equal(stats.tokens, 1);
    assert.equal(stats.totalMessages, store.AWARD_THRESHOLD + 250);
    assert.equal(stats.progress, 250);
    assert.equal(stats.messagesUntilNext, store.AWARD_THRESHOLD - 250);
  });
});
