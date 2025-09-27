const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../src/commands/inventory');
const tokenStore = require('../src/utils/messageTokenStore');
const judgementStore = require('../src/utils/judgementStore');
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

test('inventory lists both smite and judgement balances', async () => {
  const originalSmiteProgress = tokenStore.getProgress;
  const originalJudgementProgress = judgementStore.getProgress;
  const originalIsEnabled = smiteConfigStore.isEnabled;

  tokenStore.getProgress = () => ({ tokens: 3, messagesUntilNext: 42 });
  judgementStore.getProgress = () => ({ tokens: 1, messagesUntilNext: 0 });
  smiteConfigStore.isEnabled = () => true;

  try {
    const interaction = createInteraction();
    await inventory.execute(interaction);

    const reply = interaction.getReply();
    assert(reply, 'expected inventory command to edit the reply');

    const content = reply.content;
    assert.match(content, /Smite: 3 Smites\./);
    assert.match(content, /Next Smite in 42 messages?\./);
    assert.match(content, /Judgement: 1 Judgement\./);
    assert.match(content, /You're due for a Judgement on your next message!/);
  } finally {
    tokenStore.getProgress = originalSmiteProgress;
    judgementStore.getProgress = originalJudgementProgress;
    smiteConfigStore.isEnabled = originalIsEnabled;
  }
});
