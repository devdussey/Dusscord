const { SlashCommandBuilder } = require('discord.js');
const boosterManager = require('../utils/boosterRoleManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bremblem')
    .setDescription('Update the emblem for your booster custom role')
    .addAttachmentOption(option =>
      option
        .setName('image')
        .setDescription('PNG or JPEG image under 256 KB to use as your emblem')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('clear')
        .setDescription('Remove your booster emblem')
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const shouldClear = interaction.options.getBoolean('clear') ?? false;
    const attachment = interaction.options.getAttachment('image');

    if (shouldClear && attachment) {
      return interaction.reply({
        content: 'Please choose either an image to upload or enable the clear option, not both.',
        ephemeral: true,
      });
    }

    if (!shouldClear && !attachment) {
      return interaction.reply({
        content: 'Please upload an image or enable the clear option to remove your emblem.',
        ephemeral: true,
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (err) {
        console.error('Failed to defer /bremblem interaction:', err);
        return;
      }
    }

    try {
      const result = await boosterManager.updateRoleEmblem(interaction.member, {
        attachment,
        clear: shouldClear,
      });

      let content;
      if (result.cleared) {
        content = result.hadExisting
          ? 'Cleared your booster role emblem.'
          : 'Your booster role does not currently have an emblem, but we cleared it just in case.';
      } else {
        content = result.hadExisting
          ? 'Updated your booster role emblem.'
          : 'Set a booster role emblem for you.';
      }

      await interaction.editReply({ content });
    } catch (err) {
      const message = err?.message || 'Failed to update your booster role emblem.';
      await interaction.editReply({ content: `Unable to update booster role emblem: ${message}` });
    }
  },
};
