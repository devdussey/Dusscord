const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const store = require('../utils/modLogStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('Configure moderation action logging')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set the moderation log channel')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Target text or announcement channel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('mode')
        .setDescription('Choose where moderation logs are delivered')
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
      sub.setName('toggle')
        .setDescription('Enable or disable moderation logging')
        .addBooleanOption(opt =>
          opt.setName('enabled').setDescription('Enable (true) or disable (false)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show the current configuration')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ content: 'You need Manage Server to configure moderation logging.' });
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
      const ch = interaction.options.getChannel('channel', true);
      store.set(interaction.guildId, ch.id);
      return interaction.editReply({ content: `Moderation log channel set to ${ch}.` });
    }
    if (sub === 'mode') {
      const mode = interaction.options.getString('delivery', true);
      store.setMode(interaction.guildId, mode);
      return interaction.editReply({ content: `Moderation log delivery set to: ${mode}.` });
    }
    if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled', true);
      store.setEnabled(interaction.guildId, enabled);
      return interaction.editReply({ content: `Moderation logging is now ${enabled ? 'enabled' : 'disabled'}.` });
    }
    if (sub === 'show') {
      const id = store.get(interaction.guildId);
      const mode = store.getMode(interaction.guildId);
      const enabled = store.getEnabled(interaction.guildId);
      const chText = id ? `<#${id}> (${id})` : 'not set';
      return interaction.editReply({ content: `Moderation log settings:\n- channel: ${chText}\n- delivery: ${mode}\n- enabled: ${enabled}` });
    }
    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};

