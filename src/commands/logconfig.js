const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const securityLogStore = require('../utils/securityLogStore');
const modLogStore = require('../utils/modLogStore');
const logChannelsStore = require('../utils/logChannelsStore');
const joinLogConfigStore = require('../utils/joinLogConfigStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logconfig')
    .setDescription('Show the status of logging configuration'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ content: 'You need Manage Server to view this.' });
    }

    const guildId = interaction.guildId;

    const [securityEnabled, modEnabled, channelList] = await Promise.all([
      securityLogStore.getEnabled(guildId),
      modLogStore.getEnabled(guildId),
      logChannelsStore.list(guildId),
    ]);
    const joinCfg = joinLogConfigStore.getConfig(guildId); // synchronous

    const embed = new EmbedBuilder()
      .setTitle('Logging Configuration')
      .addFields(
        { name: 'Security Log', value: securityEnabled ? '✅' : '❌', inline: true },
        { name: 'Moderation Log', value: modEnabled ? '✅' : '❌', inline: true },
        {
          name: 'Log Channels',
          value: Array.isArray(channelList) && channelList.length > 0 ? '✅' : '❌',
          inline: true,
        },
        { name: 'Join Log Config', value: joinCfg ? '✅' : '❌', inline: true },
      );

    try {
      const { applyDefaultColour } = require('../utils/guildColourStore');
      applyDefaultColour(embed, guildId);
    } catch (_) {
      // ignore colour failures
    }

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch {
      await interaction.editReply({ content: 'Failed to build log configuration summary.' });
    }
  },
};

