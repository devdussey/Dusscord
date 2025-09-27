const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../src/commands/inventory');
const tokenStore = require('../src/utils/messageTokenStore');
const smiteConfigStore = require('../src/utils/smiteConfigStore');

function createInteraction() {
  let reply;
  return {
    inGuild: () => true,
    guildId: 'guild',
    user: { id: 'user' },
    deferReply: () => Promise.resolve(),
    editReply: (data) => {
      reply = data;
      return Promise.resolve(data);
    },
    getReply: () => reply,
  };
}

test('inventory lists smite balance and status', async () => {
  const originalSmiteProgress = tokenStore.getProgress;
  const originalIsEnabled = smiteConfigStore.isEnabled;

  tokenStore.getProgress = () => ({ tokens: 3, messagesUntilNext: 42 });
  smiteConfigStore.isEnabled = () => true;

  try {
    const interaction = createInteraction();
    await inventory.execute(interaction);

    const reply = interaction.getReply();
    assert(reply, 'expected inventory command to edit the reply');

    const content = reply.content;
    assert.match(content, /Smite: 3 Smites\./);
    assert.match(content, /Next Smite in 42 messages?\./);
    assert.match(content, /Smite rewards are currently enabled on this server\./);
  } finally {
    tokenStore.getProgress = originalSmiteProgress;
    smiteConfigStore.isEnabled = originalIsEnabled;
  }
});
