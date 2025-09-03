const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../utils/securityLogger');

function parseDurationMs(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  const regex = /^(\d+)(s|m|h|d)$/; // seconds, minutes, hours, days
  const match = trimmed.match(regex);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member for a period (reason required)')
    .addUserOption(opt =>
      opt
        .setName('target')
        .setDescription('Member to mute')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('duration')
        .setDescription('Duration (e.g., 10m, 1h, 2d). Max 28d')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Reason for the mute')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    // Acknowledge early to avoid interaction timeouts (public reply)
    await interaction.deferReply();

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await logger.logPermissionDenied(interaction, 'mute', 'Bot missing Moderate Members');
      return interaction.editReply({ content: 'I need the Moderate Members permission.' });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      await logger.logPermissionDenied(interaction, 'mute', 'User missing Moderate Members');
      return interaction.editReply({ content: 'You need Moderate Members to use this command.' });
    }

    const user = interaction.options.getUser('target', true);
    const durationStr = interaction.options.getString('duration', true);
    const reasonRaw = interaction.options.getString('reason', true).trim();
    const reason = reasonRaw.slice(0, 400) || 'No reason provided';

    if (user.id === interaction.user.id) {
      return interaction.editReply({ content: "You can't mute yourself." });
    }
    if (user.id === interaction.client.user.id) {
      return interaction.editReply({ content: "You can't mute me with this command." });
    }

    // Parse and validate duration
    let durationMs = parseDurationMs(durationStr);
    if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) {
      return interaction.editReply({ content: 'Invalid duration. Use formats like 10m, 1h, 2d (max 28d).' });
    }
    const MAX_MS = 28 * 24 * 60 * 60 * 1000; // 28 days
    if (durationMs > MAX_MS) durationMs = MAX_MS;

    // Fetch the member to ensure they are in the guild
    let memberToMute;
    try {
      memberToMute = await interaction.guild.members.fetch(user.id);
    } catch (_) {
      return interaction.editReply({ content: 'That user is not in this server.' });
    }

    // Hierarchy checks
    const meHigher = me.roles.highest.comparePositionTo(memberToMute.roles.highest) > 0;
    if (!meHigher || !memberToMute.moderatable) {
      await logger.logHierarchyViolation(interaction, 'mute', memberToMute, 'Bot lower than target or not moderatable');
      return interaction.editReply({ content: "I can't mute that member due to role hierarchy or permissions." });
    }

    const requesterHigher = interaction.member.roles.highest.comparePositionTo(memberToMute.roles.highest) > 0
      || interaction.guild.ownerId === interaction.user.id;
    if (!requesterHigher) {
      await logger.logHierarchyViolation(interaction, 'mute', memberToMute, 'Requester lower or equal to target');
      return interaction.editReply({ content: "You can't mute someone with an equal or higher role." });
    }

    try {
      const auditReason = `By ${interaction.user.tag} (${interaction.user.id}) | ${reason}`.slice(0, 512);
      await memberToMute.timeout(durationMs, auditReason);
      await interaction.editReply({ content: `Muted ${user.tag} for ${durationStr} | Reason: ${reason}` });
    } catch (err) {
      await interaction.editReply({ content: `Failed to mute: ${err.message || 'Unknown error'}` });
    }
  },
};
