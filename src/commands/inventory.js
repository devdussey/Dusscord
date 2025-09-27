const { SlashCommandBuilder } = require('discord.js');
const tokenStore = require('../utils/messageTokenStore');
const judgementStore = require('../utils/judgementStore');
const smiteConfigStore = require('../utils/smiteConfigStore');

const BAG_LABEL = 'Smite';
const JUDGEMENT_LABEL = 'Judgement';

function formatCurrencyProgress(label, progress = {}) {
  const tokens = Number.isFinite(progress.tokens) ? Math.max(0, Math.floor(progress.tokens)) : 0;
  const messagesUntilNextRaw = Number.isFinite(progress.messagesUntilNext)
    ? Math.max(0, Math.floor(progress.messagesUntilNext))
    : 0;
  const plural = tokens === 1 ? '' : 's';
  const baseLine = `${label}: ${tokens} ${label}${plural}.`;
  const nextLine = messagesUntilNextRaw > 0
    ? `Next ${label} in ${messagesUntilNextRaw} message${messagesUntilNextRaw === 1 ? '' : 's'}.`
    : `You're due for a ${label} on your next message!`;
  return `${baseLine} ${nextLine}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Check how many Smites you currently have available'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server to view your items.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const smiteProgress = tokenStore.getProgress(interaction.guildId, interaction.user.id);
    const judgementProgress = judgementStore.getProgress(interaction.guildId, interaction.user.id);

    const smiteLine = formatCurrencyProgress(BAG_LABEL, smiteProgress);
    const judgementLine = formatCurrencyProgress(JUDGEMENT_LABEL, judgementProgress);

    const smiteEnabled = smiteConfigStore.isEnabled(interaction.guildId);
    const statusLine = smiteEnabled
      ? 'Smite rewards are currently enabled on this server.'
      : 'Smite rewards are currently disabled on this server.';

    const response = [smiteLine, judgementLine, statusLine].join('\n').slice(0, 1900);
    await interaction.editReply({ content: response });
  },
};
