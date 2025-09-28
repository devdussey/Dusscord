const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const logger = require('../utils/securityLogger');
const { isOwner } = require('../utils/ownerIds');
const premiumManager = require('../utils/premiumManager');

// In-memory store for active isolations per guild+user
// Key: `${guildId}:${userId}` -> { channelId, intervalId, stopAt }
const activeIsolations = new Map();

function key(gid, uid) { return `${gid}:${uid}`; }

function parseDuration(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^([0-9]+)\s*([smhd])$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000;
  return n * mult;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wraith')
    .setDescription('invoke wraith')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Create a private channel for the member and begin spamming messages.')
        .addUserOption(opt => opt.setName('member').setDescription('Member to isolate').setRequired(true))
        .addStringOption(opt => opt.setName('message').setDescription('Custom message to send repeatedly').setRequired(true))
        // Optional options must come after required ones
        .addStringOption(opt => opt.setName('duration').setDescription('How long to spam (e.g., 2m, 10m, 1h). Max 15m').setRequired(false))
        .addIntegerOption(opt => opt.setName('interval').setDescription('Seconds between messages (min 1, default 5)').setRequired(false).setMinValue(1).setMaxValue(60))
        .addIntegerOption(opt => opt.setName('max').setDescription('Max messages to send (default 120, max 500)').setRequired(false).setMinValue(5).setMaxValue(500))
        .addBooleanOption(opt => opt.setName('hide').setDescription('Temporarily hide all other channels from the member').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('stop')
        .setDescription('Stop spamming the member and optionally delete the channel.')
        .addUserOption(opt => opt.setName('member').setDescription('Member to stop isolating').setRequired(true))
        .addBooleanOption(opt => opt.setName('delete').setDescription('Delete the private channel (default: true)').setRequired(false))
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    if (!(await premiumManager.ensurePremium(interaction, 'Wraith isolation'))) return;

    // Bot owner-only check
    if (!isOwner(interaction.user.id)) {
      try { await logger.logPermissionDenied(interaction, 'wraith', 'User is not a bot owner'); } catch (_) {}
      return interaction.reply({ content: 'This command is restricted to bot owners.', ephemeral: true });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: 'I need Manage Channels permission to create private channels.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const target = interaction.options.getUser('member', true);
      if (target.bot) {
        return interaction.reply({ content: 'Target must be a human member.', ephemeral: true });
      }

      let member;
      try { member = await interaction.guild.members.fetch(target.id); } catch (_) {}
      if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });

      const durationStr = interaction.options.getString('duration');
      const intervalSec = interaction.options.getInteger('interval') ?? 5;
      const maxMsgs = interaction.options.getInteger('max') ?? 120;
      const customMsg = interaction.options.getString('message');
      const hideOthers = interaction.options.getBoolean('hide') || false;

      // Safety caps
      const intervalMs = Math.max(1, Math.min(60, intervalSec)) * 1000;
      const durationMsRaw = parseDuration(durationStr);
      const durationMs = durationMsRaw ? Math.min(durationMsRaw, 15 * 60 * 1000) : null; // cap 15m
      const maxMessages = Math.min(Math.max(5, maxMsgs), 500);

      const k = key(interaction.guild.id, member.id);
      if (activeIsolations.has(k)) {
        const existing = activeIsolations.get(k);
        return interaction.reply({ content: `Already isolating <@${member.id}> in <#${existing.channelId}>. Use /wraith stop to end.`, ephemeral: true });
      }

      // Create or reuse a private channel
      const baseName = `isolate-${member.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`.replace(/-+/g, '-').slice(0, 90);
      const channelName = baseName || `isolate-${member.id}`;

      // Permission overwrites: deny @everyone, allow target, allow owner, allow bot
      const overwrites = [
        { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: me.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
      ];

      let channel;
      try {
        channel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          permissionOverwrites: overwrites,
          reason: `Isolation channel for ${member.user.tag} started by ${interaction.user.tag}`,
        });
      } catch (err) {
        return interaction.reply({ content: `Failed to create channel: ${err.message}`, ephemeral: true });
      }

      await interaction.reply({ content: `Created <#${channel.id}>. Starting spam for ${durationMs ? Math.round(durationMs/60000) + 'm' : 'a while'} at ~${Math.round(intervalMs/1000)}s interval (max ${maxMessages} msgs).${hideOthers ? ' Hiding other channels for the member during wraith.' : ''}`, ephemeral: true });

      // Optionally hide all other channels from the member by adding a temporary user overwrite
      let hiddenOverwrites = [];
      if (hideOthers) {
        for (const ch of interaction.guild.channels.cache.values()) {
          try {
            if (!ch || ch.id === channel.id) continue;
            // Skip threads – cannot manage overwrites the same way
            if (ch.type === ChannelType.PublicThread || ch.type === ChannelType.PrivateThread) continue;
            if (!ch.permissionOverwrites || typeof ch.permissionOverwrites.edit !== 'function') continue;
            const canView = ch.permissionsFor?.(member)?.has(PermissionsBitField.Flags.ViewChannel);
            if (!canView) continue; // already hidden
            const existing = ch.permissionOverwrites.resolve(member.id);
            if (existing) {
              hiddenOverwrites.push({ channelId: ch.id, existed: true, allow: existing.allow?.bitfield, deny: existing.deny?.bitfield });
            } else {
              hiddenOverwrites.push({ channelId: ch.id, existed: false });
            }
            await ch.permissionOverwrites.edit(member.id, { ViewChannel: false, reason: `Wraith hide by ${interaction.user.tag}` });
          } catch (_) { /* ignore individual channel failures */ }
        }
      }

      const stopAt = durationMs ? Date.now() + durationMs : null;
      let sent = 0;
      const text = customMsg || 'Your isolation has begun.';

      const createEmbed = (count) => new EmbedBuilder()
        .setTitle('👻 The Wraith Draws Near')
        .setDescription('You have been isolated. Stay put and cooperate to end the haunting.')
        .setColor(0x4b0082)
        .setFooter({ text: `Pulse ${count}${maxMessages ? ` · Max ${maxMessages}` : ''}` })
        .setTimestamp();

      const sendOne = async (count) => {
        try {
          await channel.send({ content: `<@${member.id}> ${text}`, embeds: [createEmbed(count)] });
        } catch (_) { /* ignore send errors during loop */ }
      };

      // Immediately send first message
      await sendOne(sent + 1);
      sent++;

      const intervalId = setInterval(async () => {
        if (stopAt && Date.now() >= stopAt) {
          clearInterval(intervalId);
          activeIsolations.delete(k);
          try { await channel.send({ content: 'Stopping.' }); } catch (_) {}
          return;
        }
        if (sent >= maxMessages) {
          clearInterval(intervalId);
          activeIsolations.delete(k);
          try { await channel.send({ content: 'Reached max messages. Stopping.' }); } catch (_) {}
          return;
        }
        sent++;
        await sendOne(sent);
      }, intervalMs);

      activeIsolations.set(k, { channelId: channel.id, intervalId, stopAt, hiddenOverwrites });
      return; // reply already sent
    }

    if (sub === 'stop') {
      const target = interaction.options.getUser('member', true);
      const del = interaction.options.getBoolean('delete');
      const k = key(interaction.guild.id, target.id);
      const rec = activeIsolations.get(k);
      if (!rec) {
        return interaction.reply({ content: `No active isolation found for <@${target.id}>.`, ephemeral: true });
      }
      activeIsolations.delete(k);
      try { clearInterval(rec.intervalId); } catch (_) {}

      let channel = null;
      try { channel = await interaction.guild.channels.fetch(rec.channelId); } catch (_) {}
      if (channel && del !== false) {
        try { await channel.delete('Isolation stopped by owner'); } catch (_) {}
      } else if (channel) {
        try { await channel.send({ content: 'Isolation stopped by owner.' }); } catch (_) {}
      }

      // Restore hidden channels if applicable
      const memberId = target.id;
      if (rec.hiddenOverwrites && Array.isArray(rec.hiddenOverwrites) && rec.hiddenOverwrites.length) {
        for (const info of rec.hiddenOverwrites) {
          try {
            const ch = await interaction.guild.channels.fetch(info.channelId);
            if (!ch || !ch.permissionOverwrites) continue;
            if (info.existed) {
              await ch.permissionOverwrites.edit(memberId, { allow: info.allow, deny: info.deny, reason: 'Restore after wraith' });
            } else {
              await ch.permissionOverwrites.delete(memberId, 'Restore after wraith');
            }
          } catch (_) { /* ignore individual failures */ }
        }
      }
      return interaction.reply({ content: `Stopped isolation for <@${target.id}>${channel ? (del !== false ? ' and deleted channel.' : ' and kept channel.') : '.'}`, ephemeral: true });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};
