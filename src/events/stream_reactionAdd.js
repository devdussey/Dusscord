const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');

module.exports = {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    try {
      const m = reaction.message;
      const guild = m?.guild;
      if (!guild) return;
      const emoji = reaction.emoji?.name || reaction.emoji?.id || 'unknown';
      const embed = baseEmbed(guild, 'Reaction Added')
        .addFields(
          { name: 'User', value: `${user.tag} (${user.id})`, inline: true },
          { name: 'Channel', value: m.channel ? `<#${m.channel.id}> (${m.channel.id})` : 'Unknown', inline: true },
          { name: 'Emoji', value: String(emoji), inline: true },
        );
      await send(guild, 'reactions', embed);
    } catch (_) {}
  },
};

