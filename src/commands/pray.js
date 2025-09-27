const { SlashCommandBuilder } = require('discord.js');
const coinStore = require('../utils/coinStore');
const { getPrayReward } = require('../utils/economyConfig');

function formatCoins(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
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
    .setName('pray')
    .setDescription('Offer a daily prayer to receive a coin blessing'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Daily prayers are only tracked inside servers.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const reward = getPrayReward();
    const status = coinStore.getPrayStatus(guildId, userId);

    if (!status.canPray) {
      const remaining = formatDuration(status.cooldownMs);
      return interaction.editReply({ content: `You have already prayed today. Try again in ${remaining}.` });
    }

    const result = await coinStore.recordPrayer(guildId, userId, reward);
    const rewardText = reward > 0
      ? `${formatCoins(reward)} coin${reward === 1 ? '' : 's'}`
      : 'no coins';
    const balanceText = `${formatCoins(result.balance)} coin${result.balance === 1 ? '' : 's'}`;

    return interaction.editReply({ content: `You offer a humble prayer and receive ${rewardText}. New balance: ${balanceText}.` });
  },
};
