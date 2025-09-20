const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const modulePath = require.resolve('../src/utils/messageTokenStore');

async function withTempStore(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bags-'));
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

test('awards a Smite every 200 messages', async () => {
  await withTempStore(async store => {
    const guildId = 'guild';
    const userId = 'user';
    for (let i = 0; i < 199; i++) {
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

    const file = path.join(process.env.DUSSCORD_DATA_DIR, 'message_tokens.json');
    assert.ok(fs.existsSync(file));
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(saved.guilds[guildId].users[userId].tokens, 1);
  });
});

test('consuming and refunding Smites updates balance', async () => {
  await withTempStore(async store => {
    const guildId = 'guild';
    const userId = 'user';

    for (let i = 0; i < store.AWARD_THRESHOLD; i++) {
      await store.incrementMessage(guildId, userId);
    }
    assert.equal(store.getBalance(guildId, userId), 1);

    const spent = await store.consumeToken(guildId, userId);
    assert.equal(spent, true);
    assert.equal(store.getBalance(guildId, userId), 0);

    const spentAgain = await store.consumeToken(guildId, userId);
    assert.equal(spentAgain, false);

    const refunded = await store.addTokens(guildId, userId, 2);
    assert.equal(refunded, 2);
    assert.equal(store.getBalance(guildId, userId), 2);
  });
});
