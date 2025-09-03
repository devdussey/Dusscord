const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const store = require('../utils/securityLogStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('securitylog')
    .setDescription('Configure where permission/hierarchy violation logs are sent')
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set the security log channel for this server')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Target text or announcement channel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Clear the configured security log channel')
    )
    .addSubcommand(sub =>
      sub
        .setName('show')
        .setDescription('Show the current security log channel')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ content: 'You need Manage Server to configure the security log.' });
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
      const ch = interaction.options.getChannel('channel', true);
      store.set(interaction.guildId, ch.id);
      return interaction.editReply({ content: `Security log channel set to ${ch}.` });
    }
    if (sub === 'clear') {
      store.clear(interaction.guildId);
      return interaction.editReply({ content: 'Cleared security log channel (will DM owners as fallback).' });
    }
    if (sub === 'show') {
      const id = store.get(interaction.guildId);
      if (!id) return interaction.editReply({ content: 'No security log channel set (using DM fallback).' });
      return interaction.editReply({ content: `Security log channel: <#${id}> (${id})` });
    }

    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};

