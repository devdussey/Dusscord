const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    try {
      const guild = role?.guild;
      if (!guild) return;
      const embed = baseEmbed(guild, 'Role Created')
        .addFields({ name: 'Role', value: `${role.name} (${role.id})`, inline: true });
      await send(guild, 'roles', embed);
    } catch (_) {}
  },
};

