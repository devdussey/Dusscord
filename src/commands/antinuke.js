const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const manager = require('../utils/antiNukeManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure and monitor anti-nuke protections')
    .addSubcommand(sub =>
      sub
        .setName('config')
        .setDescription('Open the anti-nuke configuration panel')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    if (sub !== 'config') {
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server to update anti-nuke settings.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const view = await manager.buildConfigView(interaction.guild);
    return interaction.editReply({ embeds: [view.embed], components: view.components });
  },
};
