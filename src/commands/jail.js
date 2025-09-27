const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const store = require('../utils/jailStore');

function parseDuration(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^([0-9]+)\s*([smhdw])$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : unit === 'd' ? 86400000 : 604800000;
  return n * mult;
}

async function safeRemoveAllRoles(member, exceptIds = []) {
  const keep = new Set(exceptIds.map(String));
  const removed = [];
  for (const role of member.roles.cache.values()) {
    if (keep.has(role.id)) continue;
    if (role.managed) continue;
    try {
      await member.roles.remove(role, 'Jail: removing roles');
      removed.push(role.id);
    } catch (_) {}
  }
  return removed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Jail system: restrict a member and optionally restore later')
    .addSubcommand(sub =>
      sub.setName('config')
        .setDescription('Configure jail role')
        .addRoleOption(opt => opt.setName('role').setDescription('Role used to jail members').setRequired(false))
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel used for jailed members')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('visibility')
            .setDescription('Default reply visibility for jail actions')
            .addChoices(
              { name: 'Public', value: 'public' },
              { name: 'Ephemeral', value: 'ephemeral' },
            )
            .setRequired(false)
        )
        .addBooleanOption(opt => opt.setName('public').setDescription('Post this response publicly (default: public)'))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Jail a member (remove roles, add jail role)')
        .addUserOption(opt => opt.setName('member').setDescription('Member to jail').setRequired(true))
        .addStringOption(opt => opt.setName('duration').setDescription('e.g., 10m, 1h, 2d').setRequired(false))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
        .addBooleanOption(opt => opt.setName('public').setDescription('Post response publicly (default: public)'))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Unjail a member and restore previous roles')
        .addUserOption(opt => opt.setName('member').setDescription('Member to unjail').setRequired(true))
        .addBooleanOption(opt => opt.setName('public').setDescription('Post response publicly (default: public)'))
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show jail info for a member or list all')
        .addUserOption(opt => opt.setName('member').setDescription('Specific member').setRequired(false))
        .addBooleanOption(opt => opt.setName('public').setDescription('Post response publicly (default: public)'))
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.' });

    const isPublic = interaction.options.getBoolean('public');
    const defaultPublic = await store.getPublicDefault(interaction.guild.id);
    const ephemeral = (isPublic === null) ? !defaultPublic : !isPublic; // default from config; public=false -> ephemeral

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'I need Manage Roles to use the jail system.', ephemeral });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'You need Manage Roles to use the jail system.', ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'config') {
      const role = interaction.options.getRole('role');
      const vis = interaction.options.getString('visibility');
      const channel = interaction.options.getChannel('channel');
      const subOptions = interaction.options.data.find(opt => opt.name === 'config')?.options || [];
      const channelProvided = subOptions.some(opt => opt.name === 'channel');
      const configOptions = subOptions.filter(opt => ['role', 'visibility', 'channel'].includes(opt.name));

      let changes = [];
      const cfg = await store.getConfig(interaction.guild.id);
      let jailRoleId = cfg.jailRoleId;
      let jailChannelId = cfg.jailChannelId;
      if (role) {
        if (role.managed) return interaction.reply({ content: 'Please choose a normal role, not a managed role.', ephemeral });
        if (me.roles.highest.comparePositionTo(role) <= 0) return interaction.reply({ content: 'My highest role must be above the jail role.', ephemeral });
        await store.setJailRole(interaction.guild.id, role.id);
        changes.push(`jail role → ${role}`);
        jailRoleId = role.id;
      }
      if (vis) {
        const pub = vis === 'public';
        await store.setPublicDefault(interaction.guild.id, pub);
        changes.push(`default visibility → ${pub ? 'public' : 'ephemeral'}`);
      }
      const needsChannelCreation = !channelProvided && configOptions.length > 0 && !jailChannelId;
      if (channel || needsChannelCreation) {
        if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: 'I need Manage Channels to update the jail channel.', ephemeral });
        }
        if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
          return interaction.reply({ content: 'You need Manage Channels to update the jail channel.', ephemeral });
        }

        const everyoneId = interaction.guild.roles.everyone.id;
        let targetChannel = channel;

        if (!targetChannel && needsChannelCreation) {
          const overwrites = [
            { id: everyoneId, deny: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          ];
          if (jailRoleId) {
            overwrites.push({
              id: jailRoleId,
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
              ],
            });
          }
          try {
            targetChannel = await interaction.guild.channels.create({
              name: 'jail',
              type: ChannelType.GuildText,
              permissionOverwrites: overwrites,
            });
          } catch (err) {
            console.error('Failed to create jail channel:', err);
            return interaction.reply({ content: 'Failed to create a jail channel. Please check my permissions and try again.', ephemeral });
          }
        }

        if (targetChannel) {
          if (targetChannel.guild.id !== interaction.guild.id) {
            return interaction.reply({ content: 'Please choose a channel from this server.', ephemeral });
          }
          if (targetChannel.type !== ChannelType.GuildText) {
            return interaction.reply({ content: 'Please choose a text channel.', ephemeral });
          }

          try {
            await targetChannel.permissionOverwrites.edit(everyoneId, {
              ViewChannel: false,
              SendMessages: false,
            });
          } catch (err) {
            console.error('Failed to update @everyone permissions for jail channel:', err);
          }

          if (jailRoleId) {
            try {
              await targetChannel.permissionOverwrites.edit(jailRoleId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
              });
            } catch (err) {
              console.error('Failed to grant jail role permissions for jail channel:', err);
            }
          }

          await store.setJailChannel(interaction.guild.id, targetChannel.id);
          jailChannelId = targetChannel.id;
          changes.push(`jail channel → ${targetChannel}`);
        }
      }
      if (!changes.length) {
        const current = await store.getConfig(interaction.guild.id);
        return interaction.reply({ content: `Current jail config:\n- role: ${current.jailRoleId ? `<@&${current.jailRoleId}>` : 'not set'}\n- channel: ${current.jailChannelId ? `<#${current.jailChannelId}>` : 'not set'}\n- default visibility: ${current.publicDefault ? 'public' : 'ephemeral'}`, ephemeral });
      }
      return interaction.reply({ content: `Updated: ${changes.join('; ')}`, ephemeral });
    }

    if (sub === 'add') {
      const targetUser = interaction.options.getUser('member', true);
      const durationStr = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      const config = await store.getConfig(interaction.guild.id);
      if (!config.jailRoleId) return interaction.reply({ content: 'Set a jail role first with /jail config role:<role>.', ephemeral });

      let jailRole = interaction.guild.roles.cache.get(config.jailRoleId);
      if (!jailRole) {
        try { jailRole = await interaction.guild.roles.fetch(config.jailRoleId); } catch (_) {}
      }
      if (!jailRole) return interaction.reply({ content: 'Configured jail role not found. Set it again with /jail config.', ephemeral });
      if (me.roles.highest.comparePositionTo(jailRole) <= 0) return interaction.reply({ content: 'My highest role must be above the jail role.', ephemeral });

      let member;
      try { member = await interaction.guild.members.fetch(targetUser.id); } catch (_) {}
      if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral });
      if (member.id === interaction.user.id) return interaction.reply({ content: 'You cannot jail yourself.', ephemeral });
      if (interaction.guild.ownerId !== interaction.user.id && interaction.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        return interaction.reply({ content: 'You must have a higher role than the target.', ephemeral });
      }
      if (me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        return interaction.reply({ content: 'My highest role must be above the target to modify roles.', ephemeral });
      }

      const except = [interaction.guild.id, jailRole.id]; // keep @everyone and jail role (if they already had it)
      const removed = await safeRemoveAllRoles(member, except);
      try { await member.roles.add(jailRole, `Jailed by ${interaction.user.tag}: ${reason}`); } catch (e) {}

      const now = Date.now();
      const ms = parseDuration(durationStr);
      const until = ms ? now + ms : null;
      await store.setJailed(interaction.guild.id, member.id, { roles: removed, reason, at: now, until });

      const embed = new EmbedBuilder()
        .setTitle('Member Jailed')
        .setColor(0xff0000)
        .setDescription(`${member.user.tag} has been jailed.`)
        .addFields(
          { name: 'Reason', value: reason, inline: false },
          { name: 'Duration', value: until ? durationStr : 'Indefinite', inline: true },
          { name: 'Removed roles', value: removed.length ? String(removed.length) : '0', inline: true },
        )
        .setTimestamp(new Date());
      return interaction.reply({ embeds: [embed], ephemeral });
    }

    if (sub === 'remove') {
      const targetUser = interaction.options.getUser('member', true);
      const config = await store.getConfig(interaction.guild.id);
      if (!config.jailRoleId) return interaction.reply({ content: 'Set a jail role first with /jail config.', ephemeral });
      let member;
      try { member = await interaction.guild.members.fetch(targetUser.id); } catch (_) {}
      if (!member) return interaction.reply({ content: 'That user is not in this server.', ephemeral });
      const rec = await store.getJailed(interaction.guild.id, member.id);
      const prevRoles = rec?.roles || [];

      // Remove jail role
      try { await member.roles.remove(config.jailRoleId, 'Unjail'); } catch (_) {}
      // Restore previous roles that still exist and are below bot
      const meTop = me.roles.highest;
      for (const roleId of prevRoles) {
        const role = interaction.guild.roles.cache.get(roleId);
        if (!role || role.managed) continue;
        if (meTop.comparePositionTo(role) <= 0) continue;
        try { await member.roles.add(role, 'Unjail: restoring previous roles'); } catch (_) {}
      }
      await store.removeJailed(interaction.guild.id, member.id);
      return interaction.reply({ content: `Unjailed ${member.user.tag}.`, ephemeral });
    }

    if (sub === 'status') {
      const user = interaction.options.getUser('member');
      const list = user ? [await store.getJailed(interaction.guild.id, user.id)].filter(Boolean) : await store.listJailed(interaction.guild.id);
      if (!list.length) return interaction.reply({ content: 'No jailed members recorded.', ephemeral });
      const lines = list.map(info => {
        const left = info.until ? Math.max(0, info.until - Date.now()) : null;
        const mins = left != null ? Math.ceil(left/60000) : null;
        return `• <@${info.userId || user?.id}> — ${info.reason || 'No reason'}${mins!=null ? ` (≈${mins}m left)` : ''}`;
      });
      return interaction.reply({ content: lines.join('\n'), ephemeral });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral });
  },
};
