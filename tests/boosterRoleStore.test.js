const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dusscord-booster-store-'));
process.env.DUSSCORD_DATA_DIR = tempDir;
const dataFile = path.join(tempDir, 'boosterRoles.json');

const modulePath = require.resolve('../src/utils/boosterRoleStore');

async function resetStoreFile(initialData) {
  const payload = initialData ?? { guilds: {} };
  await fs.promises.writeFile(dataFile, JSON.stringify(payload, null, 2), 'utf8');
}

function loadStore() {
  delete require.cache[modulePath];
  return require(modulePath);
}

test('getRoleId converts legacy string entries and preserves colour data', async () => {
  await resetStoreFile({
    guilds: {
      legacy: {
        boosters: {
          'user-a': 'role-123',
        },
      },
    },
  });

  const store = loadStore();
  const roleId = await store.getRoleId('legacy', 'user-a');
  assert.strictEqual(roleId, 'role-123');

  const solid = { mode: 'solid', colors: ['#FFA500'] };
  await store.setColorConfig('legacy', 'user-a', solid);
  assert.deepStrictEqual(await store.getColorConfig('legacy', 'user-a'), solid);

  assert.strictEqual(await store.getEmblem('legacy', 'user-a'), null);

  const boosters = await store.listBoosters('legacy');
  assert.deepStrictEqual(boosters, [
    { userId: 'user-a', roleId: 'role-123', color: solid, emblem: null },
  ]);
});

test('setRoleId and setColorConfig clear entries when data is removed', async () => {
  await resetStoreFile();
  const store = loadStore();

  const gradient = { mode: 'gradient', colors: ['#112233', '#445566'] };
  await store.setRoleId('guild-1', 'user-1', 'role-abc');
  await store.setColorConfig('guild-1', 'user-1', gradient);

  assert.strictEqual(await store.getRoleId('guild-1', 'user-1'), 'role-abc');
  assert.deepStrictEqual(await store.getColorConfig('guild-1', 'user-1'), gradient);
  assert.strictEqual(await store.getEmblem('guild-1', 'user-1'), null);

  await store.setRoleId('guild-1', 'user-1', null);
  assert.strictEqual(await store.getRoleId('guild-1', 'user-1'), null);
  assert.deepStrictEqual(await store.getColorConfig('guild-1', 'user-1'), gradient);

  await store.setColorConfig('guild-1', 'user-1', null);
  assert.strictEqual(await store.getRoleId('guild-1', 'user-1'), null);
  assert.strictEqual(await store.getColorConfig('guild-1', 'user-1'), null);
  assert.strictEqual(await store.getEmblem('guild-1', 'user-1'), null);
  assert.deepStrictEqual(await store.listBoosters('guild-1'), []);
});

test('removeByRoleId removes matching booster entries', async () => {
  await resetStoreFile();
  const store = loadStore();

  await store.setRoleId('guild-2', 'user-2', 'role-xyz');
  await store.setColorConfig('guild-2', 'user-2', { mode: 'solid', colors: ['#ABCDEF'] });

  await store.removeByRoleId('guild-2', 'role-xyz');

  assert.strictEqual(await store.getRoleId('guild-2', 'user-2'), null);
  assert.strictEqual(await store.getColorConfig('guild-2', 'user-2'), null);
  assert.strictEqual(await store.getEmblem('guild-2', 'user-2'), null);
  assert.deepStrictEqual(await store.listBoosters('guild-2'), []);
});

test('setEmblem stores metadata and cleans up files when removed', async () => {
  await resetStoreFile();
  const store = loadStore();

  const emblemPath = path.join('booster-emblems', 'guild-3', 'user-3.png');
  const absolutePath = path.join(tempDir, emblemPath);
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, 'fake');

  await store.setRoleId('guild-3', 'user-3', 'role-789');
  await store.setEmblem('guild-3', 'user-3', {
    file: emblemPath,
    contentType: 'image/png',
    uploadedAt: '2024-01-01T00:00:00.000Z',
    name: 'icon.png',
  });

  const stored = await store.getEmblem('guild-3', 'user-3');
  assert.deepStrictEqual(stored, {
    file: emblemPath,
    contentType: 'image/png',
    uploadedAt: '2024-01-01T00:00:00.000Z',
    name: 'icon.png',
  });

  assert.strictEqual(fs.existsSync(absolutePath), true);

  await store.setEmblem('guild-3', 'user-3', null);
  assert.strictEqual(await store.getEmblem('guild-3', 'user-3'), null);
  assert.strictEqual(fs.existsSync(absolutePath), false);

  assert.deepStrictEqual(await store.listBoosters('guild-3'), [
    { userId: 'user-3', roleId: 'role-789', color: null, emblem: null },
  ]);
});
