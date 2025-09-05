const { Events, PermissionsBitField } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');

function permsToList(permBits) {
  try {
    const flags = PermissionsBitField.Flags;
    const names = Object.keys(flags).filter(k => (permBits & BigInt(flags[k])) !== 0n);
    return names.slice(0, 20).join(', ') + (names.length > 20 ? '…' : '') || 'None';
  } catch (_) { return 'Unknown'; }
}

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole) {
    try {
      const guild = newRole?.guild || oldRole?.guild;
      if (!guild) return;
      const changes = [];
      if (oldRole.name !== newRole.name) changes.push({ name: 'Name', value: `${oldRole.name} → ${newRole.name}`, inline: false });
      if (oldRole.color !== newRole.color) changes.push({ name: 'Color', value: `${oldRole.color} → ${newRole.color}`, inline: false });
      if (String(oldRole.permissions?.bitfield) !== String(newRole.permissions?.bitfield)) {
        changes.push({ name: 'Permissions (old)', value: permsToList(BigInt(oldRole.permissions.bitfield)), inline: false });
        changes.push({ name: 'Permissions (new)', value: permsToList(BigInt(newRole.permissions.bitfield)), inline: false });
      }
      if (!changes.length) return;
      const embed = baseEmbed(guild, 'Role Updated', 0xffcc00)
        .addFields(
          { name: 'Role', value: `${newRole.name} (${newRole.id})`, inline: true },
          ...changes,
        );
      await send(guild, 'roles', embed);
    } catch (_) {}
  },
};

