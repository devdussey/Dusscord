const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../utils/securityLogger');
const modlog = require('../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server (reason required)')
    .addUserOption(opt =>
      opt
        .setName('target')
        .setDescription('User to ban')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for the ban (required)')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName('prune_days')
        .setDescription('Delete up to 7 days of messages')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    // Make the response public and avoid timeouts
    await interaction.deferReply();

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      await logger.logPermissionDenied(interaction, 'ban', 'Bot missing Ban Members');
      return interaction.editReply({ content: 'I need the Ban Members permission.' });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.BanMembers)) {
      await logger.logPermissionDenied(interaction, 'ban', 'User missing Ban Members');
      return interaction.editReply({ content: 'You need Ban Members to use this command.' });
    }

    const user = interaction.options.getUser('target', true);
    const reasonRaw = interaction.options.getString('reason', true).trim();
    const pruneDays = interaction.options.getInteger('prune_days') ?? 0;
    const pruneSeconds = Math.min(Math.max(pruneDays, 0), 7) * 86400;
    const reason = reasonRaw.slice(0, 400) || 'No reason provided';

    if (user.id === interaction.user.id) {
      return interaction.editReply({ content: "You can't ban yourself." });
    }
    if (user.id === interaction.client.user.id) {
      return interaction.editReply({ content: "You can't ban me with this command." });
    }

    // Try to fetch member for hierarchy checks if they are in the guild
    let targetMember = null;
    try { targetMember = await interaction.guild.members.fetch(user.id); } catch (_) {}

    if (targetMember) {
      const meHigher = me.roles.highest.comparePositionTo(targetMember.roles.highest) > 0;
      if (!meHigher || !targetMember.bannable) {
        await logger.logHierarchyViolation(interaction, 'ban', targetMember, 'Bot lower than target or not bannable');
        return interaction.editReply({ content: "I can't ban that member due to role hierarchy or permissions." });
      }

      const requesterHigher = interaction.member.roles.highest.comparePositionTo(targetMember.roles.highest) > 0
        || interaction.guild.ownerId === interaction.user.id;
      if (!requesterHigher) {
        await logger.logHierarchyViolation(interaction, 'ban', targetMember, 'Requester lower or equal to target');
        return interaction.editReply({ content: "You can't ban someone with an equal or higher role." });
      }
    }

    try {
      const auditReason = `By ${interaction.user.tag} (${interaction.user.id}) | ${reason}`.slice(0, 512);
      await interaction.guild.members.ban(user.id, {
        deleteMessageSeconds: pruneSeconds,
        reason: auditReason,
      });
      await interaction.editReply({ content: `Banned ${user.tag} for: ${reason}${pruneDays ? ` (deleted ${pruneDays}d of messages)` : ''}` });
      try { await modlog.log(interaction, 'User Banned', [
        { name: 'Target', value: `${user.tag} (${user.id})`, inline: false },
        { name: 'Reason', value: reason, inline: false },
        { name: 'Prune days', value: String(pruneDays), inline: true },
      ], 0xff0000); } catch (_) {}
    } catch (err) {
      await interaction.editReply({ content: `Failed to ban: ${err.message || 'Unknown error'}` });
    }
  },
};
