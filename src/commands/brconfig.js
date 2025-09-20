const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const boosterConfigStore = require('../utils/boosterRoleConfigStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('brconfig')
    .setDescription('Enable or disable automatic booster custom roles')
    .addBooleanOption(option =>
      option
        .setName('enabled')
        .setDescription('Enable (true) or disable (false) automatic booster roles')
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    const hasPermission = interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
    if (!hasPermission) {
      return interaction.reply({ content: 'You need Manage Server to configure booster roles.', ephemeral: true });
    }

    const desiredState = interaction.options.getBoolean('enabled');

    if (desiredState === null) {
      const enabled = await boosterConfigStore.isEnabled(interaction.guildId);
      return interaction.reply({
        content: `Custom booster roles are currently **${enabled ? 'enabled' : 'disabled'}**.`,
        ephemeral: true,
      });
    }

    const enabled = await boosterConfigStore.setEnabled(interaction.guildId, desiredState);
    const suffix = enabled
      ? 'Existing boosters can use /brsync to make sure they have a custom role.'
      : 'The bot will stop automatically creating or updating booster roles until re-enabled.';

    return interaction.reply({
      content: `Custom booster roles are now **${enabled ? 'enabled' : 'disabled'}**. ${suffix}`,
      ephemeral: true,
    });
  },
};

