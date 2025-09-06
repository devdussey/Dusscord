const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function runDeploy(dir) {
  return spawnSync('node', [path.join(__dirname, '..', 'deploy-commands.js'), '--dry-run'], {
    env: {
      ...process.env,
      DRY_RUN: '1',
      CLIENT_ID: 'test-client',
      DISCORD_TOKEN: 'test-token',
      NODE_ENV: 'development',
      GUILD_ID: '123',
      COMMANDS_DIR: dir
    },
    encoding: 'utf8'
  });
}

test('duplicate commands are ignored', async () => {
  const commandsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-cmds-'));
  const baseline = runDeploy(commandsDir);
  assert.strictEqual(baseline.status, 0);
  const baseMatch = baseline.stdout.match(/Preparing to refresh (\d+) application/);
  assert.ok(baseMatch, 'could not parse baseline command count');
  const baseCount = Number(baseMatch[1]);

  const file1 = path.join(commandsDir, 'a-duptest.js');
  const file2 = path.join(commandsDir, 'b-duptest.js');
  const content = `module.exports = { data: { toJSON() { return { name: 'duptest' }; } }, async execute() {} };`;
  fs.writeFileSync(file1, content);
  fs.writeFileSync(file2, content);

  try {
    const run = runDeploy(commandsDir);
    assert.strictEqual(run.status, 0);
    assert.ok(run.stdout.includes("Duplicate slash command name 'duptest'"), 'missing duplicate warning');
    assert.ok(run.stdout.includes('b-duptest.js'), 'missing file path for skipped command');
    const match = run.stdout.match(/Preparing to refresh (\d+) application/);
    assert.ok(match, 'could not parse command count');
    const count = Number(match[1]);
    assert.strictEqual(count, baseCount + 1);
  } finally {
    fs.rmSync(commandsDir, { recursive: true, force: true });
  }
});
