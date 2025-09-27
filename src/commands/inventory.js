const { SlashCommandBuilder } = require('discord.js');
const coinStore = require('../utils/coinStore');
const tokenStore = require('../utils/messageTokenStore');
const judgementStore = require('../utils/judgementStore');
const smiteConfigStore = require('../utils/smiteConfigStore');
const {
  getSmiteCost,
  getJudgementCost,
  getPrayReward,
} = require('../utils/economyConfig');

function formatCoins(value) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (seconds > 0 && parts.length < 2) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : '0 seconds';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Check your coin balance, Smites, and Judgements'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server to view your items.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const coinSummary = coinStore.getSummary(guildId, userId);
    const coinsLine = `Coins: ${formatCoins(coinSummary.coins)} coins.`;

    const smiteBalance = tokenStore.getBalance(guildId, userId);
    const smiteCost = getSmiteCost();
    const smiteLine = `Smites: ${smiteBalance} available. Each costs ${formatCoins(smiteCost)} coins to buy.`;

    const judgementBalance = judgementStore.getBalance(guildId, userId);
    const judgementCost = getJudgementCost();
    const judgementLine = `Judgements: ${judgementBalance} available. Each costs ${formatCoins(judgementCost)} coins to buy.`;

    const smiteEnabled = smiteConfigStore.isEnabled(guildId);
    const statusLine = smiteEnabled
      ? 'Smite rewards are currently enabled on this server.'
      : 'Smite rewards are currently disabled on this server.';

    const judgementHint = 'Judgements unlock /analysis. Earn one by spending coins or via /givejudgement.';

    const prayStatus = coinStore.getPrayStatus(guildId, userId);
    const prayReward = getPrayReward();
    const prayLine = prayStatus.canPray
      ? `Daily prayer: Ready! Use /pray to receive ${formatCoins(prayReward)} coins.`
      : `Daily prayer: Available again in ${formatDuration(prayStatus.cooldownMs)}.`;

    const response = [coinsLine, smiteLine, judgementLine, statusLine, judgementHint, prayLine]
      .join('\n')
      .slice(0, 1900);
    await interaction.editReply({ content: response });
  },
};
