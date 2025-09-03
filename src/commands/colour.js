const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setDefaultColour, getDefaultColour, parseColour, toHex6 } = require('../utils/guildColourStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('colour')
    .setDescription('Manage this server\'s default embed colour')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the default embed colour (#RGB, #RRGGBB, 0xRRGGBB)')
        .addStringOption(opt => opt.setName('value').setDescription('Colour value').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('get').setDescription('Show the current default embed colour'))
    .addSubcommand(sub => sub.setName('reset').setDescription('Reset to the bot\'s default colour'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'get') {
      const c = getDefaultColour(interaction.guildId);
      const embed = new EmbedBuilder().setTitle('Default embed colour').setDescription(`Using: ${toHex6(c)}`).setColor(c);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'reset') {
      await setDefaultColour(interaction.guildId, null);
      return interaction.reply({ content: 'Default embed colour reset to bot default.', ephemeral: true });
    }

    if (sub === 'set') {
      const raw = interaction.options.getString('value', true);
      try {
        const parsed = parseColour(raw);
        await setDefaultColour(interaction.guildId, parsed);
        const embed = new EmbedBuilder().setTitle('Default embed colour updated').setDescription(`Saved: ${toHex6(parsed)}`).setColor(parsed);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
      }
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};

