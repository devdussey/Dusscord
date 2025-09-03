const { Events, PermissionsBitField } = require('discord.js');
const store = require('../utils/autorolesStore');
const jlStore = require('../utils/joinLeaveStore');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            // Record join
            try { jlStore.addEvent(member.guild.id, member.id, 'join', Date.now()); } catch (_) {}

            const roleIds = store.getGuildRoles(member.guild.id);
            if (!roleIds.length) return;

            const me = member.guild.members.me;
            if (!me || !me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;

            const assignable = roleIds
                .map(id => member.guild.roles.cache.get(id))
                .filter(r => r && !r.managed && me.roles.highest.comparePositionTo(r) > 0);

            if (!assignable.length) return;

            await member.roles.add(assignable, 'AutoRoles assignment');
        } catch (err) {
            // Avoid crashing on assignment errors
            console.error('AutoRoles error:', err);
        }
    },
};
