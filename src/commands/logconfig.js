const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const securityLogStore = require('../utils/securityLogStore');
const modLogStore = require('../utils/modLogStore');
const logChannelsStore = require('../utils/logChannelsStore');
const joinLogConfigStore = require('../utils/joinLogConfigStore');
const streamLogStore = require('../utils/streamLogStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logconfig')
    .setDescription('Show the status of logging configuration')
    .addBooleanOption(opt =>
      opt
        .setName('enabled')
        .setDescription('Enable (true) or disable (false) all logging toggles'),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ content: 'You need Manage Server to view this.' });
    }

    const guildId = interaction.guildId;

    const desiredEnabledState = interaction.options?.getBoolean
      ? interaction.options.getBoolean('enabled')
      : null;
    if (desiredEnabledState !== null) {
      await Promise.all([
        securityLogStore.setEnabled(guildId, desiredEnabledState),
        modLogStore.setEnabled(guildId, desiredEnabledState),
        streamLogStore.setAllEnabled(guildId, desiredEnabledState),
      ]);
    }

    const [securityEnabled, modEnabled, channelList, streamStatuses] = await Promise.all([
      securityLogStore.getEnabled(guildId),
      modLogStore.getEnabled(guildId),
      logChannelsStore.list(guildId),
      streamLogStore.listStatuses(guildId),
    ]);
    const joinCfg = joinLogConfigStore.getConfig(guildId); // synchronous

    const streamEnabledCount = Object.values(streamStatuses.categories || {}).filter(Boolean).length;
    const streamTotalCount = Object.keys(streamStatuses.categories || {}).length;
    const streamStatusLabel = streamEnabledCount > 0 ? `On (${streamEnabledCount}/${streamTotalCount})` : 'Off';
    const streamDefaultChannel = streamStatuses.channelId
      ? `<#${streamStatuses.channelId}> (${streamStatuses.channelId})`
      : 'Not set';

    const embed = new EmbedBuilder()
      .setTitle('Logging Configuration')
      .addFields(
        { name: 'Security Log', value: securityEnabled ? 'On' : 'Off', inline: true },
        { name: 'Moderation Log', value: modEnabled ? 'On' : 'Off', inline: true },
        {
          name: 'Log Channels',
          value: Array.isArray(channelList) && channelList.length > 0 ? `On (${channelList.length})` : 'Off',
          inline: true,
        },
        { name: 'Join Log Config', value: joinCfg ? 'Linked' : 'Not linked', inline: true },
        {
          name: 'Stream Logs',
          value: `Status: ${streamStatusLabel}\nDefault Channel: ${streamDefaultChannel}`,
          inline: false,
        },
      );

    try {
      const { applyDefaultColour } = require('../utils/guildColourStore');
      applyDefaultColour(embed, guildId);
    } catch (_) {
      // ignore colour failures
    }

    try {
      const responsePayload = { embeds: [embed] };
      if (desiredEnabledState !== null) {
        responsePayload.content = `All logging toggles have been turned ${desiredEnabledState ? 'on' : 'off'}.`;
      }
      await interaction.editReply(responsePayload);
    } catch {
      await interaction.editReply({ content: 'Failed to build log configuration summary.' });
    }
  },
};

