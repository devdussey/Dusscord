const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('webhooks')
    .setDescription('List all webhooks in this server and their creators'),

  async execute(interaction) {
    try {
      const webhooks = await interaction.guild.fetchWebhooks();
      if (!webhooks.size) {
        await interaction.reply('No webhooks found.');
        return;
      }
      const lines = webhooks.map((wh) => {
        const creator = wh.owner?.tag || 'Unknown';
        return `• ${wh.name} (ID: ${wh.id}) - created by ${creator}`;
      });
      const content = lines.join('\n');
      if (content.length <= 2000) {
        await interaction.reply(content);
      } else {
        await interaction.reply({ content: 'Too many webhooks to display.', ephemeral: true });
      }
    } catch (error) {
      await interaction.reply({ content: 'Failed to fetch webhooks.', ephemeral: true });
    }
  },
};
