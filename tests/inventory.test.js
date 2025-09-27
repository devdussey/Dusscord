const test = require('node:test');
const assert = require('node:assert/strict');

const inventory = require('../src/commands/inventory');
const tokenStore = require('../src/utils/messageTokenStore');
const judgementStore = require('../src/utils/judgementStore');
const smiteConfigStore = require('../src/utils/smiteConfigStore');
const coinStore = require('../src/utils/coinStore');

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

test('inventory shows coin balance, item counts, and prayer status', async () => {
  const originalSmiteBalance = tokenStore.getBalance;
  const originalJudgementBalance = judgementStore.getBalance;
  const originalIsEnabled = smiteConfigStore.isEnabled;
  const originalCoinSummary = coinStore.getSummary;
  const originalPrayStatus = coinStore.getPrayStatus;

  tokenStore.getBalance = () => 3;
  judgementStore.getBalance = () => 1;
  smiteConfigStore.isEnabled = () => true;
  coinStore.getSummary = () => ({ coins: 321.5, lifetimeEarned: 0, lifetimeSpent: 0, lastPrayAt: null });
  coinStore.getPrayStatus = () => ({ canPray: false, cooldownMs: 3_600_000, nextAvailableAt: Date.now() + 3_600_000 });

  try {
    const interaction = createInteraction();
    await inventory.execute(interaction);

    const reply = interaction.getReply();
    assert(reply, 'expected inventory command to edit the reply');

    const content = reply.content;
    assert.match(content, /Coins: 321\.5 coins\./);
    assert.match(content, /Smites: 3 available\. Each costs 200 coins to buy\./);
    assert.match(content, /Judgements: 1 available\. Each costs 500 coins to buy\./);
    assert.match(content, /Smite rewards are currently enabled on this server\./);
    assert.match(content, /Judgements unlock \/analysis\. Earn one by spending coins or via \/givejudgement\./);
    assert.match(content, /Daily prayer: Available again in 1 hour\./);
  } finally {
    tokenStore.getBalance = originalSmiteBalance;
    judgementStore.getBalance = originalJudgementBalance;
    smiteConfigStore.isEnabled = originalIsEnabled;
    coinStore.getSummary = originalCoinSummary;
    coinStore.getPrayStatus = originalPrayStatus;
  }
});
