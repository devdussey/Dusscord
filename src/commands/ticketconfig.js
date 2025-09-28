const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const ticketStore = require('../utils/ticketStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketconfig')
    .setDescription('Configure global ticket settings')
    .addRoleOption(option =>
      option
        .setName('support_role')
        .setDescription('Primary support role allowed to manage tickets')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName('support_role_2')
        .setDescription('Secondary support role (optional)')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option
        .setName('support_role_3')
        .setDescription('Tertiary support role (optional)')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('archive_channel')
        .setDescription('Channel or category used for archived tickets')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
          ChannelType.GuildCategory,
        )
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('log_channel')
        .setDescription('Channel that receives ticket logs (optional)')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
        )
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('max_open')
        .setDescription('Maximum open tickets per user (default 2)')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    )

  ,
    
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server to configure tickets.', ephemeral: true });
    }

    const supportRoles = [
      interaction.options.getRole('support_role'),
      interaction.options.getRole('support_role_2'),
      interaction.options.getRole('support_role_3'),
    ].filter(Boolean);

    if (supportRoles.length === 0) {
      return interaction.reply({ content: 'You must provide at least one support role.', ephemeral: true });
    }

    const archiveChannel = interaction.options.getChannel('archive_channel');
    const logChannel = interaction.options.getChannel('log_channel');
    const maxOpen = interaction.options.getInteger('max_open') ?? 2;

    const config = ticketStore.setConfig(interaction.guildId, {
      supportRoleIds: supportRoles.map(role => role.id),
      archiveChannelId: archiveChannel.id,
      logChannelId: logChannel ? logChannel.id : null,
      maxTicketsPerUser: maxOpen,
    });

    const summary = [
      `Support roles: ${supportRoles.map(role => role.toString()).join(', ')}`,
      `Archive target: ${archiveChannel}`,
      `Log channel: ${logChannel ? logChannel.toString() : 'Not set'}`,
      `Max open tickets per user: ${config.maxTicketsPerUser}`,
    ].join('\n');

    return interaction.reply({
      content: `✅ Ticket configuration updated.\n${summary}`,
      ephemeral: true,
    });
  },
};
