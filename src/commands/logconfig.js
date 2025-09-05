const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const securityLogStore = require('../utils/securityLogStore');
const modLogStore = require('../utils/modLogStore');
const logChannelsStore = require('../utils/logChannelsStore');
const joinLogConfigStore = require('../utils/joinLogConfigStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logconfig')
    .setDescription('Show a summary of logging-related configurations'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ content: 'You need Manage Server to view this.' });
    }

    const guildId = interaction.guildId;

    // Fetch states in parallel
    const [securityEnabled, modEnabled, monitoredList] = await Promise.all([
      securityLogStore.getEnabled(guildId),
      modLogStore.getEnabled(guildId),
      logChannelsStore.list(guildId),
    ]);
    const joinCfg = joinLogConfigStore.getConfig(guildId); // sync store

    const monitoredEnabled = Array.isArray(monitoredList) && monitoredList.length > 0;
    const joinLogLinked = !!joinCfg;

    const check = (b) => (b ? '✅ Enabled' : '❌ Disabled');

    const embed = new EmbedBuilder()
      .setTitle('Logging Configuration')
      .addFields(
        { name: 'Security Log', value: check(!!securityEnabled), inline: true },
        { name: 'Moderation Log', value: check(!!modEnabled), inline: true },
        { name: 'Monitored Channels', value: monitoredEnabled ? `✅ Enabled (${monitoredList.length})` : '❌ Disabled', inline: true },
        { name: 'Join Log Link', value: joinLogLinked ? '✅ Linked' : '❌ Not linked', inline: true },
      );

    // Apply default guild colour if available
    try {
      const { applyDefaultColour } = require('../utils/guildColourStore');
      applyDefaultColour(embed, guildId);
    } catch (_) {
      // Colour application failed, continue without it
    }

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({ content: 'Failed to build log configuration summary.' });
    }
  },
};

