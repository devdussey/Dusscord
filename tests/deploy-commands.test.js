const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const commandsDir = path.join(rootDir, 'src', 'commands');

function runDeploy() {
  return spawnSync('node', ['deploy-commands.js', '--dry-run'], {
    cwd: rootDir,
    env: {
      ...process.env,
      DRY_RUN: '1',
      CLIENT_ID: 'test-client',
      DISCORD_TOKEN: 'test-token',
      NODE_ENV: 'development',
      GUILD_ID: '123'
    },
    encoding: 'utf8'
  });
}

test('duplicate commands are ignored', async () => {
  const baseline = runDeploy();
  assert.strictEqual(baseline.status, 0);
  const baseMatch = baseline.stdout.match(/Preparing to refresh (\d+) application/);
  assert.ok(baseMatch, 'could not parse baseline command count');
  const baseCount = Number(baseMatch[1]);

  const file1 = path.join(commandsDir, 'a-duptest.js');
  const file2 = path.join(commandsDir, 'b-duptest.js');
  const content = `const { SlashCommandBuilder } = require('discord.js');
module.exports = { data: new SlashCommandBuilder().setName('duptest').setDescription('test'), async execute() {} };`;
  fs.writeFileSync(file1, content);
  fs.writeFileSync(file2, content);

  try {
    const run = runDeploy();
    assert.strictEqual(run.status, 0);
    assert.ok(run.stdout.includes("Duplicate slash command name 'duptest'"), 'missing duplicate warning');
    assert.ok(run.stdout.includes('b-duptest.js'), 'missing file path for skipped command');
    const match = run.stdout.match(/Preparing to refresh (\d+) application/);
    assert.ok(match, 'could not parse command count');
    const count = Number(match[1]);
    assert.strictEqual(count, baseCount + 1);
  } finally {
    fs.unlinkSync(file1);
    fs.unlinkSync(file2);
  }
});
