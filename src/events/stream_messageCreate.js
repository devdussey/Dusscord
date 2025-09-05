const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message?.guild || !message.author) return;
      const guild = message.guild;
      const embed = baseEmbed(guild, 'Message Created')
        .addFields(
          { name: 'Author', value: `${message.author.tag} (${message.author.id})`, inline: true },
          { name: 'Channel', value: `<#${message.channel.id}> (${message.channel.id})`, inline: true },
        );
      if (message.content) embed.addFields({ name: 'Content', value: message.content.length > 1024 ? message.content.slice(0, 1021) + '…' : message.content, inline: false });
      await send(guild, 'messages', embed);
    } catch (_) {}
  },
};

