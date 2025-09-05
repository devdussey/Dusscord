const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    try {
      const guild = role?.guild;
      if (!guild) return;
      const embed = baseEmbed(guild, 'Role Deleted', 0xff4444)
        .addFields({ name: 'Role', value: `${role.name} (${role.id})`, inline: true });
      await send(guild, 'roles', embed);
    } catch (_) {}
  },
};

