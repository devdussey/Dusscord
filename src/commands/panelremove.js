const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const ticketStore = require('../utils/ticketStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panelremove')
    .setDescription('Delete a ticket panel template')
    .addStringOption(option =>
      option
        .setName('panel')
        .setDescription('Panel name or ID to remove')
        .setRequired(true)
    )

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server to remove ticket panels.', ephemeral: true });
    }

    const input = interaction.options.getString('panel');
    const byId = ticketStore.getPanel(interaction.guildId, input);
    const byName = ticketStore.getPanelByName(interaction.guildId, input);
    const target = byId || byName;

    if (!target) {
      return interaction.reply({ content: 'Panel not found. Use /panellist to view panels.', ephemeral: true });
    }

    const removed = ticketStore.removePanel(interaction.guildId, target.id);
    if (!removed) {
      return interaction.reply({ content: 'Failed to remove panel. Try again later.', ephemeral: true });
    }

    return interaction.reply({ content: `✅ Panel **${target.name}** removed.`, ephemeral: true });
  },
};
