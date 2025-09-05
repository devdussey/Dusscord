const { Events, AuditLogEvent, PermissionsBitField } = require('discord.js');
const jlStore = require('../utils/joinLeaveStore');

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
        } catch (err) { console.error('src/events/guildMemberRemove.js', err); /* ignore */ }
      }
      jlStore.addEvent(guild.id, member.id, 'leave', Date.now(), { reason });
    } catch (e) {
      // swallow
    }
  },
};

