const { Events, PermissionsBitField } = require('discord.js');
const boosterStore = require('../utils/boosterRoleStore');
const boosterManager = require('../utils/boosterRoleManager');

async function getMe(guild) {
  if (!guild) return null;
  const me = guild.members.me;
  if (me) return me;
  try { return await guild.members.fetchMe(); } catch (_) { return null; }
}

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember, newMember) {
    try {
      if (!newMember?.guild) return;
      const guild = newMember.guild;

      const enabled = await boosterStore.isGuildEnabled(guild.id);
      if (!enabled) return;

      const hadBoost = Boolean(oldMember?.premiumSinceTimestamp || oldMember?.premiumSince);
      const hasBoost = Boolean(newMember?.premiumSinceTimestamp || newMember?.premiumSince);

      if (hasBoost && !hadBoost) {
        try {
          await boosterManager.ensureRole(newMember, { createIfMissing: true });
        } catch (err) {
          console.error(`Failed to ensure booster role for ${newMember.id} in ${guild.id}:`, err);
        }
        return;
      }

      if (!hasBoost && hadBoost) {
        const roleId = await boosterStore.getRoleId(guild.id, newMember.id);
        if (!roleId) return;
        let role = null;
        try { role = await guild.roles.fetch(roleId); } catch (_) { role = null; }
        if (!role) {
          await boosterStore.deleteRole(guild.id, newMember.id);
          return;
        }

        const me = await getMe(guild);
        const canManage = me?.permissions?.has(PermissionsBitField.Flags.ManageRoles) && me.roles?.highest?.comparePositionTo(role) > 0;
        if (!canManage) return;

        try {
          if (newMember.roles?.cache?.has(role.id)) {
            await newMember.roles.remove(role, 'Booster removed their boost');
          }
        } catch (err) {
          console.warn(`Failed to remove booster role from ${newMember.id}:`, err);
        }

        try {
          await role.delete('Booster removed their boost');
        } catch (err) {
          console.warn(`Failed to delete booster role ${role.id} in ${guild.id}:`, err);
        }

        await boosterStore.deleteRole(guild.id, newMember.id);
      }
    } catch (err) {
      console.error('Failed handling booster role update:', err);
    }
  },
};
