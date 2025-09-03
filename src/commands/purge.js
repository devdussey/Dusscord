const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const logger = require('../utils/securityLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of recent messages in this channel')
    .addIntegerOption(opt =>
      opt
        .setName('amount')
        .setDescription('How many messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    // Public response and avoid timeouts
    await interaction.deferReply();

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      await logger.logPermissionDenied(interaction, 'purge', 'Bot missing Manage Messages');
      return interaction.editReply({ content: 'I need the Manage Messages permission.' });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      await logger.logPermissionDenied(interaction, 'purge', 'User missing Manage Messages');
      return interaction.editReply({ content: 'You need Manage Messages to use this command.' });
    }

    // Ensure the channel supports bulkDelete
    const channel = interaction.channel;
    const allowedTypes = new Set([
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.AnnouncementThread,
    ]);
    if (!channel || !allowedTypes.has(channel.type) || typeof channel.bulkDelete !== 'function') {
      return interaction.editReply({ content: 'This command can only be used in text channels or threads.' });
    }

    const amount = interaction.options.getInteger('amount', true);

    try {
      // filterOld=true to skip messages older than 14 days
      const deleted = await channel.bulkDelete(amount, true);
      const count = deleted?.size ?? 0;
      const note = count < amount ? ' (some messages may be older than 14 days and cannot be deleted)' : '';
      await interaction.editReply({ content: `Deleted ${count} message(s)${note}.` });
    } catch (err) {
      await interaction.editReply({ content: `Failed to purge: ${err.message || 'Unknown error'}` });
    }
  },
};
