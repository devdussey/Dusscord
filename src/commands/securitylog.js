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
        .setName('mode')
        .setDescription('Choose where logs are delivered')
        .addStringOption(opt =>
          opt.setName('delivery')
            .setDescription('Log delivery mode')
            .addChoices(
              { name: 'Channel only', value: 'channel' },
              { name: 'DM owners only', value: 'owners' },
              { name: 'Both channel and DM owners', value: 'both' },
            )
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
        .setName('toggle')
        .setDescription('Enable or disable security logging as a whole')
        .addBooleanOption(opt =>
          opt.setName('enabled')
            .setDescription('Enable (true) or disable (false) logging')
            .setRequired(true)
        )
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
      await store.set(interaction.guildId, ch.id);
      return interaction.editReply({ content: `Security log channel set to ${ch}.` });
    }
    if (sub === 'mode') {
      const mode = interaction.options.getString('delivery', true);
      await store.setMode(interaction.guildId, mode);
      return interaction.editReply({ content: `Security log delivery set to: ${mode}.` });
    }
    if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled', true);
      await store.setEnabled(interaction.guildId, enabled);
      return interaction.editReply({ content: `Security logging is now ${enabled ? 'enabled' : 'disabled'}.` });
    }
    if (sub === 'clear') {
      await store.clear(interaction.guildId);
      return interaction.editReply({ content: 'Cleared security log channel (will DM owners as fallback).' });
    }
    if (sub === 'show') {
      const id = await store.get(interaction.guildId);
      const mode = await store.getMode(interaction.guildId);
      const enabled = await store.getEnabled(interaction.guildId);
      const chText = id ? `<#${id}> (${id})` : 'not set';
      return interaction.editReply({ content: `Security log settings:\n- channel: ${chText}\n- delivery: ${mode}\n- enabled: ${enabled}` });
    }

    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};
