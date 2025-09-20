const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const boosterManager = require('../utils/boosterRoleManager');
const boosterConfigStore = require('../utils/boosterRoleConfigStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('brsync')
    .setDescription('Sync booster custom roles for existing boosters')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    const hasPermission = interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
    if (!hasPermission) {
      return interaction.reply({ content: 'You need Manage Server to sync booster roles.', ephemeral: true });
    }

    const enabled = await boosterConfigStore.isEnabled(interaction.guildId);
    if (!enabled) {
      return interaction.reply({
        content: 'Custom booster roles are disabled on this server. Enable them with /brconfig before running a sync.',
        ephemeral: true,
      });
    }

    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (err) {
      console.error('Failed to defer /brsync interaction:', err);
      return;
    }

    const guild = interaction.guild;
    let members;
    try {
      members = await guild.members.fetch();
    } catch (err) {
      console.error('Failed to fetch guild members for /brsync:', err);
      await interaction.editReply({ content: 'Unable to fetch server members. Make sure the bot has the Server Members intent enabled.' });
      return;
    }

    const premiumRoleId = guild.roles.premiumSubscriberRole?.id || null;
    const boosters = [];
    for (const member of members.values()) {
      if (!member) continue;
      if (member.user?.bot) continue;
      const hasBoost = Boolean(member.premiumSince || member.premiumSinceTimestamp);
      const hasPremiumRole = premiumRoleId ? member.roles.cache.has(premiumRoleId) : false;
      if (hasBoost || hasPremiumRole) boosters.push(member);
    }

    if (boosters.length === 0) {
      await interaction.editReply({ content: 'No active boosters were found to sync.' });
      return;
    }

    let ensured = 0;
    let created = 0;
    let failureCount = 0;
    const failureDetails = [];

    for (const member of boosters) {
      try {
        const result = await boosterManager.ensureRole(member, { createIfMissing: true });
        if (result?.role) {
          ensured += 1;
          if (result.created) created += 1;
        }
      } catch (err) {
        failureCount += 1;
        const reason = err?.message || 'Unknown error';
        const label = member.user?.tag || member.id || 'Unknown member';
        if (failureDetails.length < 5) {
          failureDetails.push(`- ${label}: ${reason}`);
        }
      }
    }

    let message = `Checked ${boosters.length} booster${boosters.length === 1 ? '' : 's'}.`;
    if (ensured > 0) {
      message += ` Ensured custom roles for ${ensured} booster${ensured === 1 ? '' : 's'}.`;
    }
    if (created > 0) {
      message += ` Created ${created} new custom role${created === 1 ? '' : 's'}.`;
    }
    if (ensured === 0 && created === 0) {
      message += ' No custom roles required updates.';
    }

    if (failureCount > 0) {
      message += `\nFailed to sync ${failureCount} booster${failureCount === 1 ? '' : 's'}:`;
      message += `\n${failureDetails.join('\n')}`;
      if (failureCount > failureDetails.length) {
        const remaining = failureCount - failureDetails.length;
        message += `\n...and ${remaining} more.`;
      }
    }

    await interaction.editReply({ content: message });
  },
};

