const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const securityStore = require('../utils/securityLogStore');
const modStore = require('../utils/modLogStore');
const joinCfgStore = require('../utils/joinLogConfigStore');
const logChannelsStore = require('../utils/logChannelsStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logconfig')
    .setDescription('Show logging categories and whether they are enabled'),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ content: 'You need Manage Server to view log configuration.' });
    }

    const guildId = interaction.guildId;
    const statuses = [
      { name: 'Security logging', enabled: securityStore.getEnabled(guildId) },
      { name: 'Moderation logging', enabled: modStore.getEnabled(guildId) },
      { name: 'Join/leave log', enabled: !!joinCfgStore.getConfig(guildId) },
      { name: 'Monitored log channels', enabled: logChannelsStore.list(guildId).length > 0 },
    ];

    const embed = new EmbedBuilder()
      .setTitle('Log Configuration')
      .setColor(0x00aa00);

    for (const s of statuses) {
      embed.addFields({ name: s.name, value: s.enabled ? '✅ Enabled' : '❌ Disabled', inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};
