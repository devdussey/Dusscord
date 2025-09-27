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
    user: { id: 'user', username: 'Tester' },
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

    const embedBuilder = reply.embeds && reply.embeds[0];
    assert(embedBuilder, 'expected an embed in the inventory response');

    const embed = typeof embedBuilder.toJSON === 'function' ? embedBuilder.toJSON() : embedBuilder;

    assert.equal(embed.title, "Tester's Divine Inventory");
    assert.match(embed.description, /Spend coins in \/store to expand your arsenal\./);

    const [coinsField, smiteField, judgementField, prayerField] = embed.fields;
    assert(coinsField, 'expected coins field');
    assert.match(coinsField.value, /Balance:\*\* 321\.5/);
    assert.match(coinsField.value, /Coins are the divine currency/);

    assert(smiteField, 'expected smite field');
    assert.match(smiteField.value, /Owned:\*\* 3/);
    assert.match(smiteField.value, /Cost:\*\* 200/);
    assert.match(smiteField.value, /Smite rewards are currently \*\*enabled\*\*/);

    assert(judgementField, 'expected judgement field');
    assert.match(judgementField.value, /Owned:\*\* 1/);
    assert.match(judgementField.value, /Cost:\*\* 500/);
    assert.match(judgementField.value, /unlock the powerful \/analysis command/);

    assert(prayerField, 'expected prayer field');
    assert.match(prayerField.value, /Already blessed. You can pray again in 1 hour\./);
  } finally {
    tokenStore.getBalance = originalSmiteBalance;
    judgementStore.getBalance = originalJudgementBalance;
    smiteConfigStore.isEnabled = originalIsEnabled;
    coinStore.getSummary = originalCoinSummary;
    coinStore.getPrayStatus = originalPrayStatus;
  }
});
