const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadCommands } = require('../src/handlers/commandHandler');

test('malformed command is logged and skipped', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmds-'));
  const badFile = path.join(tmpDir, 'malformed.test.js');
  fs.writeFileSync(badFile, 'module.exports = { data: { name: "bad" }, execute() { }');
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const client = { commands: new Map() };
    assert.doesNotThrow(() => loadCommands(client, tmpDir));
    assert(!client.commands.has('bad'));
    assert(logs.some(l => l.includes('Failed to load command') && l.includes('malformed.test.js')));
  } finally {
    console.log = originalLog;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
