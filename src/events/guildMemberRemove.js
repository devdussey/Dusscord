const { Events, AuditLogEvent, PermissionsBitField, EmbedBuilder } = require('discord.js');
const jlStore = require('../utils/joinLeaveStore');
const leaveStore = require('../utils/leaveStore');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    try {
      const guild = member.guild;
      const client = member.client;
      // Determine if kicked/banned via audit logs (best-effort)
      let reason = 'left';
      const me = guild.members.me;
      if (me && me.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
        try {
          const logs = await guild.fetchAuditLogs({ limit: 5 });
          const recent = logs.entries.filter(e => (Date.now() - e.createdTimestamp) < 10_000);
          const kick = recent.find(e => e.action === AuditLogEvent.MemberKick && e.target?.id === member.id);
          const ban = recent.find(e => e.action === AuditLogEvent.MemberBanAdd && e.target?.id === member.id);
          if (kick) reason = 'kick';
          if (ban) reason = 'ban';
        } catch (_) { /* ignore */ }
      }
      jlStore.addEvent(guild.id, member.id, 'leave', Date.now(), { reason });
    } catch (e) {
      // swallow
    }

    try {
      const cfg = leaveStore.get(member.guild.id);
      if (!cfg || !cfg.channelId || !cfg.embed) return;
      const channel = await member.guild.channels.fetch(cfg.channelId).catch(() => null);
      if (!channel || !channel.isTextBased?.()) return;

      const userTag = member.user?.tag || member.user?.username || member.user?.id || 'User';
      const replacer = (value) => String(value || '')
        .replaceAll('{user}', userTag)
        .replaceAll('{mention}', `<@${member.id}>`)
        .replaceAll('{guild}', `${member.guild.name}`)
        .replaceAll('{memberCount}', `${member.guild.memberCount}`);

      const embed = EmbedBuilder.from(cfg.embed);
      const data = embed.toJSON();
      if (data.title) embed.setTitle(replacer(data.title));
      if (data.description) embed.setDescription(replacer(data.description));
      if (data.footer?.text) embed.setFooter({ text: replacer(data.footer.text), iconURL: data.footer.icon_url || undefined });

      await channel.send({ content: replacer('{user} has left the server.'), embeds: [embed] });
    } catch (_) {
      // ignore leave message failures
    }
  },
};

