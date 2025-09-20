const { PermissionsBitField, SlashCommandBuilder } = require('discord.js');
const boosterManager = require('../utils/boosterRoleManager');
const boosterStore = require('../utils/boosterRoleStore');

function canManage(interaction) {
  const perms = interaction.memberPermissions;
  if (!perms) return false;
  return (
    perms.has(PermissionsBitField.Flags.ManageRoles) ||
    perms.has(PermissionsBitField.Flags.ManageGuild)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('brsync')
    .setDescription('Ensure current boosters have their custom roles assigned'),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    if (!canManage(interaction)) {
      return interaction.reply({
        content: 'You need the Manage Roles or Manage Guild permission to sync booster roles.',
        ephemeral: true,
      });
    }

    const enabled = await boosterStore.isGuildEnabled(interaction.guildId);
    if (!enabled) {
      return interaction.reply({
        content: 'Booster roles are currently disabled on this server.',
        ephemeral: true,
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (err) {
        console.error('Failed to defer /brsync interaction:', err);
        return;
      }
    }

    let summary;
    try {
      summary = await boosterManager.syncBoosters(interaction.guild);
    } catch (err) {
      const message = err?.message || 'Failed to sync booster roles.';
      await interaction.editReply({ content: `Unable to sync booster roles: ${message}` });
      return;
    }

    const { totalBoosters, ensured, created, failed } = summary;
    let content =
      `Checked **${totalBoosters}** boosting member${totalBoosters === 1 ? '' : 's'} ` +
      `and confirmed custom roles for **${ensured}**.`;
    if (created > 0) {
      content += ` Created **${created}** new role${created === 1 ? '' : 's'}.`;
    }
    if (failed.length > 0) {
      const details = failed
        .slice(0, 5)
        .map(entry => `• <@${entry.userId}> (${entry.message})`)
        .join('\n');
      content += `\n\nEncountered **${failed.length}** issue${failed.length === 1 ? '' : 's'}:`;
      content += `\n${details}`;
      if (failed.length > 5) {
        content += '\n…and more. Check the logs for full details.';
      }
    }

    await interaction.editReply({ content });
  },
};
