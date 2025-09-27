const { Events, AuditLogEvent, PermissionsBitField, EmbedBuilder } = require('discord.js');
const store = require('../utils/logChannelsStore');
const { parseOwnerIds } = require('../utils/ownerIds');
const { resolveEmbedColour } = require('../utils/guildColourStore');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    try {
      if (!message?.guild || !message.channel) return;
      const guild = message.guild;

      // Only act if this channel is configured as a monitored log channel
      const monitored = await store.list(guild.id);
      if (!monitored.includes(message.channel.id)) return;

      const client = message.client;
      const me = guild.members.me;
      if (!me) return;

      // Try to identify who deleted via audit logs (requires View Audit Log)
      let executor = null;
      if (me.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
        try {
          const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 });
          // Find an entry that likely matches this deletion
          const entry = logs.entries.find(e => {
            if (!e) return false;
            // Match channel and, if available, target user
            const channelOk = (e.extra?.channel?.id === message.channel.id) || (e.extra?.channelId === message.channel.id);
            const targetOk = message.author ? (e.target?.id === message.author.id) : true;
            // Recent (within ~10s)
            const recent = (Date.now() - e.createdTimestamp) < 10_000;
            return channelOk && targetOk && recent;
          });
          if (entry) executor = entry.executor || null;
        } catch (_) {
          // ignore fetch/audit issues
        }
      }

      // Only notify if the deleter is staff (Administrator or Manage Messages)
      let isStaffDeleter = false;
      if (executor) {
        try {
          const m = await guild.members.fetch(executor.id);
          isStaffDeleter = m.permissions.has(PermissionsBitField.Flags.Administrator) || m.permissions.has(PermissionsBitField.Flags.ManageMessages);
        } catch (_) { /* ignore */ }
      }
      // If executor unknown, still alert owners as requested
      if (executor && !isStaffDeleter) return; // known non-staff deleter, skip

      const owners = parseOwnerIds();
      if (!owners.length) return; // no owners configured

      // Build alert embed
      const authorTag = message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown (uncached)';
      const contentPreview = message.content ? (message.content.length > 1024 ? message.content.slice(0, 1021) + '…' : message.content) : '*No content available*';
      const attachInfo = message.attachments?.size ? `${message.attachments.size} attachment(s)` : 'None';
      const fields = [
        { name: 'Guild', value: `${guild.name} (${guild.id})`, inline: false },
        { name: 'Channel', value: `<#${message.channel.id}> (${message.channel.id})`, inline: false },
        { name: 'Author', value: authorTag, inline: false },
        { name: 'Deleted By', value: executor ? `${executor.tag} (${executor.id})` : 'Unknown', inline: false },
        { name: 'Message ID', value: message.id || 'Unknown', inline: true },
        { name: 'Attachments', value: attachInfo, inline: true },
        { name: 'Content', value: contentPreview, inline: false },
      ];
      const embed = new EmbedBuilder()
        .setTitle('Admin deleted a message in a monitored log channel')
        .setColor(resolveEmbedColour(guild.id, 0x0000ff))
        .setTimestamp(new Date())
        .addFields(fields);

      // DM each configured owner
      for (const ownerId of owners) {
        try {
          const user = await client.users.fetch(ownerId);
          await user.send({ embeds: [embed] });
        } catch (err) {
          // ignore DM failures
        }
      }
    } catch (err) {
      console.error('messageDelete handler error:', err);
    }
  },
};
