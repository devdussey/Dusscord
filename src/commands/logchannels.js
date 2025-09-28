const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const store = require('../utils/logChannelsStore');
const premiumManager = require('../utils/premiumManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tamperproof')
    .setDescription('Configure channels monitored for admin deletions (DM alert to owners)')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a channel to the monitored list')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to monitor')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a channel from the monitored list')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to remove')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List monitored channels')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });

    if (!(await premiumManager.ensurePremium(interaction, 'Tamperproof monitoring'))) return;

    await interaction.deferReply({ ephemeral: true });

    // Require Manage Channels to configure
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.editReply({ content: 'You need Manage Channels to configure this.' });
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const ch = interaction.options.getChannel('channel', true);
      await store.add(interaction.guildId, ch.id);
      return interaction.editReply({ content: `Added ${ch} to the tamper-proof watch list.` });
    }
    if (sub === 'remove') {
      const ch = interaction.options.getChannel('channel', true);
      const removed = await store.remove(interaction.guildId, ch.id);
      return interaction.editReply({ content: removed ? `Removed ${ch} from the tamper-proof watch list.` : `${ch} was not monitored.` });
    }
    if (sub === 'list') {
      const ids = await store.list(interaction.guildId);
      if (!ids.length) return interaction.editReply({ content: 'No tamper-proof channels configured.' });
      const names = ids.map(id => interaction.guild.channels.cache.get(id) ? `<#${id}>` : `Unknown(${id})`);
      return interaction.editReply({ content: `Tamper-proof channels: ${names.join(', ')}` });
    }

    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};

