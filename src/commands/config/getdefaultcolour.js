// Shows the current server default embed colour.

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDefaultColour, toHex6 } = require('../../utils/guildColourStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('getdefaultcolour')
    .setDescription("Show this server's default embed colour"),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    const c = getDefaultColour(interaction.guildId);
    const embed = new EmbedBuilder()
      .setTitle('Current default embed colour')
      .setDescription(`Using: **${toHex6(c)}**`)
      .setColor(c);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

