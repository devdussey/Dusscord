const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const ticketStore = require('../utils/ticketStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panellist')
    .setDescription('Show all configured ticket panels'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server to view ticket panels.', ephemeral: true });
    }

    const panels = ticketStore.listPanels(interaction.guildId);
    if (!panels.length) {
      return interaction.reply({ content: 'No ticket panels configured yet. Use /panelsetup to create one.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Ticket Panels')
      .setColor(0x5865f2)
      .setDescription('Use `/ticketsend` to post one of the panels to a channel.');

    for (const panel of panels) {
      const componentLabel = panel.component?.type === 'menu' ? `Select menu (${panel.component.options.length} options)` : `Button (${panel.component.label})`;
      embed.addFields({
        name: `${panel.name} • ID ${panel.id}`,
        value: [
          `Type: **${panel.ticketType === 'thread' ? 'Thread' : 'Channel'}**`,
          `Component: **${componentLabel}**`,
          panel.logChannelId ? `Logs: <#${panel.logChannelId}>` : 'Logs: Inherit global',
          panel.archiveChannelId ? `Archive: <#${panel.archiveChannelId}>` : 'Archive: Inherit global',
        ].join('\n').slice(0, 1024),
        inline: false,
      });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
