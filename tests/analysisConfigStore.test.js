const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const modulePath = require.resolve('../src/utils/analysisConfigStore');

async function withTempStore(fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-config-'));
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

test('analysis persona set/show/clear cycle persists to disk', async () => {
  await withTempStore(async (store, dir) => {
    assert.equal(store.getPersona('guild'), null);
    await assert.rejects(() => store.setPersona('guild', '   '), /cannot be empty/i);
    const saved = await store.setPersona('guild', ' Investigator persona ');
    assert.equal(saved, 'Investigator persona');
    assert.equal(store.getPersona('guild'), 'Investigator persona');
    const file = path.join(dir, 'analysis_config.json');
    assert.ok(fs.existsSync(file));
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(raw.guilds.guild.persona, 'Investigator persona');
    const cleared = await store.clearPersona('guild');
    assert.equal(cleared, true);
    assert.equal(store.getPersona('guild'), null);
  });
});

test('judgement tokens can be added, consumed, and refunded', async () => {
  await withTempStore(async (store) => {
    assert.equal(store.getJudgementBalance('g', 'u'), 0);
    assert.equal(await store.consumeJudgementToken('g', 'u'), false);
    await store.addJudgementTokens('g', 'u', 2);
    assert.equal(store.getJudgementBalance('g', 'u'), 2);
    assert.equal(await store.consumeJudgementToken('g', 'u'), true);
    assert.equal(store.getJudgementBalance('g', 'u'), 1);
    await store.refundJudgementToken('g', 'u');
    assert.equal(store.getJudgementBalance('g', 'u'), 2);
  });
});
