const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const tokenStore = require('../utils/messageTokenStore');
const securityLogger = require('../utils/securityLogger');
const modLogger = require('../utils/modLogger');

const BAG_LABEL = 'Smite';
const MAX_MINUTES = 10;
const PROTECTED_PERMISSIONS = new PermissionsBitField([
  PermissionsBitField.Flags.Administrator,
  PermissionsBitField.Flags.ModerateMembers,
  PermissionsBitField.Flags.ManageGuild,
  PermissionsBitField.Flags.ManageRoles,
  PermissionsBitField.Flags.KickMembers,
  PermissionsBitField.Flags.BanMembers,
]);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('drugscordbag')
    .setDescription('Spend a Smite to timeout a user for up to 10 minutes.')
    .addUserOption(opt =>
      opt
        .setName('target')
        .setDescription('Member to timeout')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName('duration')
        .setDescription('Timeout duration in minutes (1-10). Defaults to 10 minutes.')
        .setMinValue(1)
        .setMaxValue(MAX_MINUTES)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for spending the Smite (optional, max 200 characters).')
        .setMaxLength(200)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await securityLogger.logPermissionDenied(interaction, 'drugscordbag', 'Bot missing Moderate Members');
      return interaction.editReply({ content: 'I need the Moderate Members permission to spend Smites.' });
    }

    const balance = tokenStore.getBalance(interaction.guild.id, interaction.user.id);
    if (balance <= 0) {
      const progress = tokenStore.getProgress(interaction.guild.id, interaction.user.id);
      const remaining = progress.messagesUntilNext || tokenStore.AWARD_THRESHOLD;
      return interaction.editReply({
        content: `You do not have any ${BAG_LABEL}s. Send ${remaining} more message${remaining === 1 ? '' : 's'} to earn your next one.`,
      });
    }

    const targetUser = interaction.options.getUser('target', true);
    if (targetUser.id === interaction.user.id) {
      return interaction.editReply({ content: "You can't use a Smite on yourself." });
    }
    if (targetUser.id === interaction.client.user.id) {
      return interaction.editReply({ content: "You can't spend a Smite on me." });
    }
    if (targetUser.bot) {
      return interaction.editReply({ content: "You can't use a Smite on a bot." });
    }

    let targetMember;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch (_) {
      return interaction.editReply({ content: 'That user is not in this server.' });
    }

    if (targetMember.permissions.has(PROTECTED_PERMISSIONS)) {
      await securityLogger.logPermissionDenied(interaction, 'drugscordbag', 'Target has protected permissions', [
        { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
      ]);
      return interaction.editReply({ content: 'You cannot spend Smites on moderators or administrators.' });
    }

    const meHigher = me.roles.highest.comparePositionTo(targetMember.roles.highest) > 0;
    if (!meHigher || !targetMember.moderatable) {
      await securityLogger.logHierarchyViolation(interaction, 'drugscordbag', targetMember, 'Bot lower than target or not moderatable');
      return interaction.editReply({ content: "I can't timeout that member due to role hierarchy or permissions." });
    }

    const requesterHigher = interaction.member.roles.highest.comparePositionTo(targetMember.roles.highest) > 0
      || interaction.guild.ownerId === interaction.user.id;
    if (!requesterHigher) {
      await securityLogger.logHierarchyViolation(interaction, 'drugscordbag', targetMember, 'Requester lower or equal to target');
      return interaction.editReply({ content: "You can't timeout someone with an equal or higher role." });
    }

    const durationInput = interaction.options.getInteger('duration');
    let durationMinutes = durationInput ?? MAX_MINUTES;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) durationMinutes = MAX_MINUTES;
    if (durationMinutes > MAX_MINUTES) durationMinutes = MAX_MINUTES;
    const durationMs = durationMinutes * 60_000;

    const reasonRaw = (interaction.options.getString('reason') || '').trim();
    const reason = reasonRaw.slice(0, 200);

    const spent = await tokenStore.consumeToken(interaction.guild.id, interaction.user.id);
    if (!spent) {
      return interaction.editReply({ content: `You no longer have a ${BAG_LABEL} to spend.` });
    }

    try {
      const auditReasonParts = [`${BAG_LABEL} used by ${interaction.user.tag} (${interaction.user.id})`];
      if (reason) auditReasonParts.push(`Reason: ${reason}`);
      const auditReason = auditReasonParts.join(' | ').slice(0, 512);
      await targetMember.timeout(durationMs, auditReason);

      const remainingBags = tokenStore.getBalance(interaction.guild.id, interaction.user.id);
      const humanReason = reason || 'No reason provided';
      const baseMessage = `Timed out ${targetUser.tag} for ${durationMinutes} minute${durationMinutes === 1 ? '' : 's'} using a ${BAG_LABEL}.`;
      const replyMessage = `${baseMessage} Remaining Smites: ${remainingBags}. Reason: ${humanReason}`;
      await interaction.editReply({ content: replyMessage });

      try {
        await modLogger.log(interaction, 'Smite Timeout', [
          { name: 'Target', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
          { name: 'Duration', value: `${durationMinutes} minute${durationMinutes === 1 ? '' : 's'}`, inline: true },
          { name: 'Reason', value: humanReason, inline: false },
          { name: 'Remaining Smites', value: String(remainingBags), inline: true },
        ], 0x2ecc71);
      } catch (_) {}
    } catch (err) {
      await tokenStore.addTokens(interaction.guild.id, interaction.user.id, 1);
      const errorMsg = err?.message ? `Failed to timeout the member: ${err.message}` : 'Failed to timeout the member.';
      await interaction.editReply({ content: `${errorMsg} Your ${BAG_LABEL} was refunded.` });
    }
  },
};
