const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const ticketStore = require('../utils/ticketStore');
const { buildEmbed, panelComponents } = require('../utils/ticketManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketsend')
    .setDescription('Post a ticket panel to a channel')
    .addStringOption(option =>
      option
        .setName('panel')
        .setDescription('Panel name or ID to send')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to post the panel in')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server to send ticket panels.', ephemeral: true });
    }

    const input = interaction.options.getString('panel');
    const byId = ticketStore.getPanel(interaction.guildId, input);
    const byName = ticketStore.getPanelByName(interaction.guildId, input);
    const panel = byId || byName;

    if (!panel) {
      return interaction.reply({ content: 'Panel not found. Use /panellist to view panels.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    if (!channel || !channel.isTextBased()) {
      return interaction.reply({ content: 'Select a text-based channel to send the panel.', ephemeral: true });
    }

    const embed = buildEmbed(panel.embed);
    const components = panelComponents(panel);

    try {
      await channel.send({ embeds: [embed], components });
    } catch (err) {
      console.error('Failed to send ticket panel:', err);
      return interaction.reply({ content: 'Failed to send ticket panel. Check my permissions.', ephemeral: true });
    }

    return interaction.reply({ content: `✅ Panel **${panel.name}** sent to ${channel}.`, ephemeral: true });
  },
};
