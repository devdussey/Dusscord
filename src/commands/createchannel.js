const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const modlog = require('../utils/modLogger');

const TYPE_CHOICES = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  announcement: ChannelType.GuildAnnouncement,
  stage: ChannelType.GuildStageVoice,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createchannel')
    .setDescription('Create a new channel')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Channel name')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Channel type')
        .addChoices(
          { name: 'Text', value: 'text' },
          { name: 'Voice', value: 'voice' },
          { name: 'Announcement', value: 'announcement' },
          { name: 'Stage', value: 'stage' },
        )
    )
    .addChannelOption(opt =>
      opt.setName('category')
        .setDescription('Category to create the channel in')
        .addChannelTypes(ChannelType.GuildCategory)
    )
    .addStringOption(opt =>
      opt.setName('topic')
        .setDescription('Channel topic (text channels only)')
    )
    .addBooleanOption(opt =>
      opt.setName('nsfw')
        .setDescription('Mark the channel as NSFW (text channels only)')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    const me = interaction.guild.members.me;
    if (!me?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: 'I need the Manage Channels permission.', ephemeral: true });
    }

    if (!interaction.member?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: 'You need Manage Channels to use this command.', ephemeral: true });
    }

    const nameRaw = interaction.options.getString('name', true).trim();
    if (!nameRaw) {
      return interaction.reply({ content: 'Channel name cannot be empty.', ephemeral: true });
    }
    const name = nameRaw.slice(0, 100);

    const typeInput = interaction.options.getString('type') ?? 'text';
    const type = TYPE_CHOICES[typeInput] ?? ChannelType.GuildText;

    const category = interaction.options.getChannel('category');
    const topicRaw = interaction.options.getString('topic');
    const topic = topicRaw ? topicRaw.slice(0, 1024) : undefined;
    const nsfw = interaction.options.getBoolean('nsfw') ?? false;

    const channelData = {
      name,
      type,
      reason: `Created by ${interaction.user.tag} (${interaction.user.id}) via /createchannel`,
    };

    if (category) {
      channelData.parent = category.id;
    }

    if (type === ChannelType.GuildText || type === ChannelType.GuildAnnouncement) {
      if (topic) channelData.topic = topic;
      channelData.nsfw = nsfw;
    }

    try {
      const channel = await interaction.guild.channels.create(channelData);

      try {
        await modlog.log(interaction, 'Channel Created', [
          { name: 'Channel', value: `${channel} (${channel.id})`, inline: false },
          { name: 'Type', value: typeInput, inline: true },
          { name: 'Category', value: category ? `${category} (${category.id})` : 'None', inline: true },
        ]);
      } catch (err) {
        console.error('Failed to log channel creation', err);
      }

      return interaction.reply({
        content: `Created channel ${channel.toString()}${category ? ` in ${category.toString()}` : ''}.`,
        ephemeral: true,
      });
    } catch (err) {
      return interaction.reply({
        content: `Failed to create channel: ${err.message || 'Unknown error'}`,
        ephemeral: true,
      });
    }
  },
};
