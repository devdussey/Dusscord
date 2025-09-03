const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../utils/securityLogger');
const modlog = require('../utils/modLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server (reason required)')
    .addUserOption(opt =>
      opt
        .setName('target')
        .setDescription('Member to kick')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for the kick (required)')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    // Make the response public and avoid timeouts
    await interaction.deferReply();

    // Permission checks
    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      await logger.logPermissionDenied(interaction, 'kick', 'Bot missing Kick Members');
      return interaction.editReply({ content: 'I need the Kick Members permission.' });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.KickMembers)) {
      await logger.logPermissionDenied(interaction, 'kick', 'User missing Kick Members');
      return interaction.editReply({ content: 'You need Kick Members to use this command.' });
    }

    const user = interaction.options.getUser('target', true);
    const reasonRaw = interaction.options.getString('reason', true).trim();
    const reason = reasonRaw.slice(0, 400) || 'No reason provided';

    if (user.id === interaction.user.id) {
      return interaction.editReply({ content: "You can't kick yourself." });
    }
    if (user.id === interaction.client.user.id) {
      return interaction.editReply({ content: "You can't kick me with this command." });
    }

    // Fetch the member to ensure they are in the guild
    let memberToKick;
    try {
      memberToKick = await interaction.guild.members.fetch(user.id);
    } catch (_) {
      return interaction.editReply({ content: 'That user is not in this server.' });
    }

    // Hierarchy checks
    const meHigher = me.roles.highest.comparePositionTo(memberToKick.roles.highest) > 0;
    if (!meHigher || !memberToKick.kickable) {
      await logger.logHierarchyViolation(interaction, 'kick', memberToKick, 'Bot lower than target or not kickable');
      return interaction.editReply({ content: "I can't kick that member due to role hierarchy or permissions." });
    }

    const requesterHigher = interaction.member.roles.highest.comparePositionTo(memberToKick.roles.highest) > 0
      || interaction.guild.ownerId === interaction.user.id;
    if (!requesterHigher) {
      await logger.logHierarchyViolation(interaction, 'kick', memberToKick, 'Requester lower or equal to target');
      return interaction.editReply({ content: "You can't kick someone with an equal or higher role." });
    }

    // Perform kick
    try {
      const auditReason = `By ${interaction.user.tag} (${interaction.user.id}) | ${reason}`.slice(0, 512);
      await memberToKick.kick(auditReason);
      await interaction.editReply({ content: `Kicked ${user.tag} for: ${reason}` });
      try { await modlog.log(interaction, 'User Kicked', [
        { name: 'Target', value: `${user.tag} (${user.id})`, inline: false },
        { name: 'Reason', value: reason, inline: false },
      ], 0xffa500); } catch (_) {}
    } catch (err) {
      await interaction.editReply({ content: `Failed to kick: ${err.message || 'Unknown error'}` });
    }
  },
};
