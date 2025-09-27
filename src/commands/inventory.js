const { SlashCommandBuilder } = require('discord.js');
const tokenStore = require('../utils/messageTokenStore');
const smiteConfigStore = require('../utils/smiteConfigStore');

const BAG_LABEL = 'Smite';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Check how many Smites you currently have available'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server to view your items.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const { tokens, messagesUntilNext } = tokenStore.getProgress(interaction.guildId, interaction.user.id);
    const plural = tokens === 1 ? '' : 's';
    const baseLine = `You have ${tokens} ${BAG_LABEL}${plural}.`;

    const nextLine = messagesUntilNext > 0
      ? `Next ${BAG_LABEL} in ${messagesUntilNext} message${messagesUntilNext === 1 ? '' : 's'}.`
      : `You're due for a ${BAG_LABEL} on your next message!`;

    const smiteEnabled = smiteConfigStore.isEnabled(interaction.guildId);
    const statusLine = smiteEnabled
      ? 'Smite rewards are currently enabled on this server.'
      : 'Smite rewards are currently disabled on this server.';

    const response = `${baseLine} ${nextLine} ${statusLine}`.slice(0, 1900);
    await interaction.editReply({ content: response });
  },
};
