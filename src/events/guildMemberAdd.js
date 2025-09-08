const { Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const store = require('../utils/autorolesStore');
const jlStore = require('../utils/joinLeaveStore');
const welcomeStore = require('../utils/welcomeStore');
const blacklist = require('../utils/blacklistStore');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const info = await blacklist.get(member.guild.id, member.id);
            if (info) {
                try {
                    await member.send(`You are blacklisted from ${member.guild.name}. Reason: ${info.reason || 'No reason provided'}`);
                } catch (_) {}
                try {
                    await member.ban({ reason: `Blacklisted: ${info.reason || 'No reason provided'}` });
                } catch (err) {
                    console.error('Failed to auto-ban blacklisted user:', err);
                }
                return;
            }
        } catch (_) {}

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

        // Send welcome embed if configured (best-effort; do not block joins)
        try {
            const cfg = welcomeStore.get(member.guild.id);
            if (!cfg || !cfg.channelId || !cfg.embed) return;
            const channel = await member.guild.channels.fetch(cfg.channelId).catch(() => null);
            if (!channel || !channel.isTextBased?.()) return;

            // Build embed from stored JSON and replace placeholders in text fields
            const replacer = (s) => String(s || '')
                .replaceAll('{user}', `${member.user.tag}`)
                .replaceAll('{mention}', `<@${member.id}>`)
                .replaceAll('{guild}', `${member.guild.name}`)
                .replaceAll('{memberCount}', `${member.guild.memberCount}`);

            const base = EmbedBuilder.from(cfg.embed);
            const data = base.toJSON();
            if (data.title) base.setTitle(replacer(data.title));
            if (data.description) base.setDescription(replacer(data.description));
            if (data.footer?.text) base.setFooter({ text: replacer(data.footer.text), iconURL: data.footer.icon_url || undefined });

            await channel.send({ content: replacer('Welcome {mention}!'), embeds: [base] });
        } catch (e) {
            // swallow
        }
    },
};
