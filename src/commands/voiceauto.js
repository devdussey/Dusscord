const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const store = require('../utils/voiceAutoStore');

function isTextLike(channel) {
  if (!channel) return false;
  return [
    ChannelType.GuildText,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.GuildAnnouncement,
  ].includes(channel.type);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voiceauto')
    .setDescription('Configure automatic voice-message transcription')
    .addSubcommand(sub =>
      sub.setName('enable')
        .setDescription('Enable automatic transcription in a channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to enable (defaults to the current channel)')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
              ChannelType.GuildAnnouncement,
            )
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('Disable automatic transcription in a channel or everywhere')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to disable (defaults to the current channel)')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
              ChannelType.GuildAnnouncement,
            )
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('all')
            .setDescription('Disable automatic transcription for all channels')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Show channels with automatic voice transcription enabled')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server channel.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    if (!member?.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ content: 'You need the Manage Server permission to configure this.' });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'enable') {
      const providedChannel = interaction.options.getChannel('channel');
      const target = providedChannel || interaction.channel;
      if (!isTextLike(target)) {
        return interaction.editReply({ content: 'Please choose a text channel or thread.' });
      }
      const added = await store.enableChannel(guildId, target.id);
      if (!added) {
        return interaction.editReply({ content: `Automatic transcription is already enabled in ${target}.` });
      }
      return interaction.editReply({ content: `Automatic transcription enabled in ${target}.` });
    }

    if (sub === 'disable') {
      const disableAll = interaction.options.getBoolean('all') || false;
      if (disableAll) {
        const hadAny = await store.clearGuild(guildId);
        if (hadAny) {
          return interaction.editReply({ content: 'Automatic voice transcription disabled for all channels.' });
        }
        return interaction.editReply({ content: 'Automatic voice transcription was already disabled everywhere.' });
      }
      const providedChannel = interaction.options.getChannel('channel');
      const target = providedChannel || interaction.channel;
      if (!isTextLike(target)) {
        return interaction.editReply({ content: 'Please choose a text channel or thread.' });
      }
      const removed = await store.disableChannel(guildId, target.id);
      if (!removed) {
        return interaction.editReply({ content: `Automatic transcription was not enabled in ${target}.` });
      }
      return interaction.editReply({ content: `Automatic transcription disabled in ${target}.` });
    }

    if (sub === 'status') {
      const channels = await store.listChannels(guildId);
      if (!channels.length) {
        return interaction.editReply({ content: 'Automatic voice transcription is not enabled in any channels.' });
      }
      const names = channels.map(id => `<#${id}> (${id})`).join('\n');
      return interaction.editReply({ content: `Automatic transcription is enabled in:\n${names}` });
    }

    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};
