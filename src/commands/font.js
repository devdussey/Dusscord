const { SlashCommandBuilder } = require('discord.js');
const { fontChoices, transformWithFont } = require('../utils/fontStyles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('font')
    .setDescription('Render your text using a decorative font style.')
    .addStringOption(option =>
      option
        .setName('style')
        .setDescription('Font style to apply to your message')
        .setRequired(true)
        .setChoices(...fontChoices)
    )
    .addStringOption(option =>
      option
        .setName('message')
        .setDescription('The message to render in the selected font')
        .setRequired(true)
    ),

  async execute(interaction) {
    const style = interaction.options.getString('style', true);
    const message = interaction.options.getString('message', true);

    let stylized;
    try {
      stylized = transformWithFont(message, style);
    } catch (error) {
      return interaction.reply({
        content: 'That font style is not available right now. Please pick a different option.',
        ephemeral: true,
      });
    }

    if (stylized.length === 0) {
      return interaction.reply({ content: 'Please provide a message to transform.', ephemeral: true });
    }

    if (stylized.length > 2000) {
      return interaction.reply({
        content: 'The transformed message is too long to send. Try a shorter message.',
        ephemeral: true,
      });
    }

    return interaction.reply({ content: stylized, allowedMentions: { parse: [] } });
  },
};
