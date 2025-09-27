const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const modulePath = require.resolve('../src/utils/userMessageLogStore');

async function withTempStore(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'user-messages-'));
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

test('records messages up to the maximum per user', async () => {
  await withTempStore(async store => {
    const guildId = 'guild';
    const userId = 'user';
    for (let i = 0; i < store.MAX_PER_USER + 100; i++) {
      await store.recordMessage(guildId, userId, {
        id: `msg-${i}`,
        channelId: 'chan',
        content: `message ${i}`,
        createdTimestamp: 1_000 + i,
      });
    }
    const logs = store.getRecentMessages(guildId, userId, store.MAX_PER_USER);
    assert.equal(logs.length, store.MAX_PER_USER);
    assert.equal(logs[0].id, `msg-100`);
    assert.equal(logs.at(-1).id, `msg-${store.MAX_PER_USER + 99}`);

    const file = path.join(process.env.DUSSCORD_DATA_DIR, 'user_messages.json');
    assert.ok(fs.existsSync(file));
  });
});

test('sanitises mentions and records attachments when content empty', async () => {
  await withTempStore(async store => {
    const guildId = 'guild';
    const userId = 'user';
    await store.recordMessage(guildId, userId, {
      id: 'msg-1',
      channelId: 'chan',
      content: 'Hello <@123> and <#456>',
      createdTimestamp: 500,
    });
    await store.recordMessage(guildId, userId, {
      id: 'msg-2',
      channelId: 'chan',
      content: '',
      createdTimestamp: 600,
      attachments: new Map([
        ['a', { name: 'file.png' }],
      ]),
    });

    const logs = store.getRecentMessages(guildId, userId, 10);
    assert.equal(logs.length, 2);
    assert.match(logs[0].content, /Hello \[@123\] and \[#channel:456\]/);
    assert.match(logs[1].content, /Attachments: file\.png/);
  });
});

test('recordMessagesBulk stores messages in chronological order', async () => {
  await withTempStore(async store => {
    const guildId = 'bulk-guild';
    const userId = 'bulk-user';
    const messages = [
      { id: 'm2', channelId: 'chan', content: 'second', createdTimestamp: 2000 },
      { id: 'm1', channelId: 'chan', content: 'first', createdTimestamp: 1000 },
      { id: 'm3', channelId: 'chan', content: 'third', createdTimestamp: 3000 },
    ];

    const result = await store.recordMessagesBulk(guildId, userId, messages);
    assert.equal(result.added, 3);

    const logs = store.getRecentMessages(guildId, userId, 10);
    assert.equal(logs.length, 3);
    assert.equal(logs[0].id, 'm1');
    assert.equal(logs[1].id, 'm2');
    assert.equal(logs[2].id, 'm3');
  });
});
