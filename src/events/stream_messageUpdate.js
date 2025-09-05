const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    try {
      const msg = newMessage || oldMessage;
      if (!msg?.guild || !msg.channel) return;
      const guild = msg.guild;
      const before = oldMessage?.content || '(unknown)';
      const after = newMessage?.content || '(unknown)';
      if (before === after) return;
      const embed = baseEmbed(guild, 'Message Edited', 0xffcc00)
        .addFields(
          { name: 'Author', value: msg.author ? `${msg.author.tag} (${msg.author.id})` : 'Unknown', inline: true },
          { name: 'Channel', value: `<#${msg.channel.id}> (${msg.channel.id})`, inline: true },
          { name: 'Message ID', value: msg.id || 'Unknown', inline: true },
          { name: 'Before', value: String(before).slice(0, 1024) || '\u200B', inline: false },
          { name: 'After', value: String(after).slice(0, 1024) || '\u200B', inline: false },
        );
      await send(guild, 'messages', embed);
    } catch (_) {}
  },
};

