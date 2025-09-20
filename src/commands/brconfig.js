const { PermissionsBitField, SlashCommandBuilder } = require('discord.js');
const boosterStore = require('../utils/boosterRoleStore');

function hasManagePermission(interaction) {
  const perms = interaction.memberPermissions;
  if (!perms) return false;
  return (
    perms.has(PermissionsBitField.Flags.ManageGuild) ||
    perms.has(PermissionsBitField.Flags.ManageRoles)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('brconfig')
    .setDescription('Enable or disable booster custom roles for this server')
    .addBooleanOption(option =>
      option
        .setName('enabled')
        .setDescription('Enable booster roles (true) or disable them (false)')
        .setRequired(true)
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    if (!hasManagePermission(interaction)) {
      return interaction.reply({
        content: 'You need the Manage Guild or Manage Roles permission to configure booster roles.',
        ephemeral: true,
      });
    }

    const enabled = interaction.options.getBoolean('enabled', true);

    try {
      await boosterStore.setGuildEnabled(interaction.guildId, enabled);
    } catch (err) {
      console.error(`Failed to update booster role configuration for ${interaction.guildId}:`, err);
      return interaction.reply({
        content: 'Something went wrong while saving the booster role configuration. Please try again later.',
        ephemeral: true,
      });
    }

    const status = enabled ? 'enabled' : 'disabled';
    let message = `Booster roles are now **${status}** for this server.`;
    if (enabled) {
      message += ' Use /brsync to ensure existing boosters receive their roles.';
    }

    return interaction.reply({ content: message, ephemeral: true });
  },
};
