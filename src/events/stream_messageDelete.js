const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    try {
      if (!message?.guild || !message.channel) return;
      const guild = message.guild;
      const embed = baseEmbed(guild, 'Message Deleted', 0xff4444)
        .addFields(
          { name: 'Channel', value: `<#${message.channel.id}> (${message.channel.id})`, inline: true },
          { name: 'Author', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: true },
          { name: 'Message ID', value: message.id || 'Unknown', inline: true },
        );
      if (message.content) embed.addFields({ name: 'Content', value: message.content.length > 1024 ? message.content.slice(0, 1021) + '…' : message.content, inline: false });
      await send(guild, 'messages', embed);
    } catch (_) {}
  },
};

