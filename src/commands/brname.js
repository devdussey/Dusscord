const { SlashCommandBuilder } = require('discord.js');
const boosterManager = require('../utils/boosterRoleManager');
const boosterConfigStore = require('../utils/boosterRoleConfigStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('brname')
    .setDescription('Rename your booster custom role')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('The new name for your booster role')
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const enabled = await boosterConfigStore.isEnabled(interaction.guildId);
    if (!enabled) {
      return interaction.reply({
        content: 'Custom booster roles are disabled on this server. Ask a server manager to enable them with /brconfig.',
        ephemeral: true,
      });
    }

    const requestedName = interaction.options.getString('name', true);
    const sanitized = boosterManager.sanitizeCustomName(requestedName);
    if (!sanitized) {
      return interaction.reply({ content: 'Please provide a valid name to use for your booster role.', ephemeral: true });
    }
    if (/@everyone|@here/.test(sanitized)) {
      return interaction.reply({ content: 'You cannot include mass mentions in your booster role name.', ephemeral: true });
    }

    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (err) {
        console.error('Failed to defer /brname interaction:', err);
        return;
      }
    }

    try {
      const role = await boosterManager.renameRole(interaction.member, sanitized);
      const content = role ? `Your booster role is now called **${role.name}**.` : 'Updated your booster role.';
      await interaction.editReply({ content });
    } catch (err) {
      const message = err?.message || 'Failed to rename your booster role.';
      await interaction.editReply({ content: `Unable to rename booster role: ${message}` });
    }
  },
};
