const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    try {
      const guild = member?.guild;
      if (!guild) return;
      const embed = baseEmbed(guild, 'User Joined')
        .addFields({ name: 'User', value: `${member.user.tag} (${member.id})`, inline: true });
      await send(guild, 'users', embed);
    } catch (_) {}
  },
};

