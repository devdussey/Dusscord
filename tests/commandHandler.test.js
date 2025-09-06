const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadCommands } = require('../src/handlers/commandHandler');

test('malformed command is logged and skipped', () => {
  const commandsDir = path.join(__dirname, '..', 'src', 'commands');
  const badFile = path.join(commandsDir, 'malformed.test.js');
  fs.writeFileSync(badFile, 'module.exports = { data: { name: "bad" }, execute() { }');
  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const client = { commands: new Map() };
    assert.doesNotThrow(() => loadCommands(client));
    assert(!client.commands.has('bad'));
    assert(logs.some(l => l.includes('Failed to load command') && l.includes('malformed.test.js')));
  } finally {
    console.log = originalLog;
    fs.unlinkSync(badFile);
  }
});
