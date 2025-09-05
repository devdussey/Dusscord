const test = require('node:test');
const assert = require('node:assert/strict');

const logconfig = require('../src/commands/logconfig');
const securityLogStore = require('../src/utils/securityLogStore');
const modLogStore = require('../src/utils/modLogStore');
const logChannelsStore = require('../src/utils/logChannelsStore');
const joinLogConfigStore = require('../src/utils/joinLogConfigStore');

function createInteraction() {
  let reply;
  return {
    inGuild: () => true,
    guildId: 'guild',
    member: { permissions: { has: () => true } },
    deferReply: () => Promise.resolve(),
    editReply: (data) => {
      reply = data;
      return Promise.resolve(data);
    },
    getReply: () => reply,
  };
}

test('logconfig shows correct states for enabled and disabled', async () => {
  const origSec = securityLogStore.getEnabled;
  const origMod = modLogStore.getEnabled;
  const origList = logChannelsStore.list;
  const origJoin = joinLogConfigStore.getConfig;

  try {
    // Enabled scenario
    securityLogStore.getEnabled = async () => true;
    modLogStore.getEnabled = async () => true;
    logChannelsStore.list = async () => ['a', 'b'];
    joinLogConfigStore.getConfig = () => ({ channelId: 'c' });

    const interaction1 = createInteraction();
    await logconfig.execute(interaction1);
    const fields1 = interaction1.getReply().embeds[0].data.fields;
    assert.strictEqual(fields1[0].value, 'On');
    assert.strictEqual(fields1[1].value, 'On');
    assert.strictEqual(fields1[2].value, 'On (2)');
    assert.strictEqual(fields1[3].value, 'Linked');

    // Disabled scenario
    securityLogStore.getEnabled = async () => false;
    modLogStore.getEnabled = async () => false;
    logChannelsStore.list = async () => [];
    joinLogConfigStore.getConfig = () => null;

    const interaction2 = createInteraction();
    await logconfig.execute(interaction2);
    const fields2 = interaction2.getReply().embeds[0].data.fields;
    assert.strictEqual(fields2[0].value, 'Off');
    assert.strictEqual(fields2[1].value, 'Off');
    assert.strictEqual(fields2[2].value, 'Off');
    assert.strictEqual(fields2[3].value, 'Not linked');
  } finally {
    securityLogStore.getEnabled = origSec;
    modLogStore.getEnabled = origMod;
    logChannelsStore.list = origList;
    joinLogConfigStore.getConfig = origJoin;
  }
});

