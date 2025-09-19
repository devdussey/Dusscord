const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');
const antiNukeManager = require('../utils/antiNukeManager');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    try {
      const guild = role?.guild;
      if (!guild) return;
      const embed = baseEmbed(guild, 'Role Deleted', 0xff4444)
        .addFields({ name: 'Role', value: `${role.name} (${role.id})`, inline: true });
      await send(guild, 'roles', embed);
      try {
        await antiNukeManager.handleDestructiveAction(guild, 'roleDelete', role);
      } catch (err) {
        console.error('Anti-nuke role delete processing failed:', err);
      }
    } catch (_) {}
  },
};

