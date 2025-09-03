const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channelsync')
    .setDescription('Sync channel permission overwrites with their category')
    .addChannelOption(opt =>
      opt.setName('category')
        .setDescription('Limit to a specific category')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('dry_run')
        .setDescription('Show what would change without applying')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: 'I need the Manage Channels permission.', ephemeral: true });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ content: 'You need Manage Channels to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const category = interaction.options.getChannel('category');
    const dryRun = interaction.options.getBoolean('dry_run') ?? false;

    // Collect target channels (children of the given category, or all channels with a parent)
    const candidates = [];
    const validTypes = new Set([
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildVoice,
      ChannelType.GuildStageVoice,
      ChannelType.GuildForum,
      ChannelType.GuildMedia,
    ]);

    for (const ch of interaction.guild.channels.cache.values()) {
      if (!validTypes.has(ch.type)) continue;
      if (!ch.parentId) continue;
      if (category && ch.parentId !== category.id) continue;
      candidates.push(ch);
    }

    if (!candidates.length) {
      const scope = category ? `in ${category.name}` : 'in this server';
      return interaction.editReply({ content: `No child channels found to sync ${scope}.` });
    }

    let ok = 0, fail = 0;
    const errors = [];
    for (const ch of candidates) {
      if (dryRun) {
        ok++;
        continue;
      }
      try {
        // lockPermissions copies overwrites from the parent category
        await ch.lockPermissions(`Requested by ${interaction.user.tag} (${interaction.user.id}) via /channelsync`);
        ok++;
      } catch (err) {
        fail++;
        if (errors.length < 5) errors.push(`${ch.name}: ${err.message || 'error'}`);
      }
    }

    const scope = category ? `for category ${category.name}` : 'across all categories';
    const summary = dryRun
      ? `Dry run: would sync ${ok} channel(s) ${scope}.`
      : `Synced ${ok} channel(s) ${scope}${fail ? `; ${fail} failed` : ''}.`;

    if (errors.length) {
      return interaction.editReply({ content: `${summary}\nIssues: \n- ${errors.join('\n- ')}` });
    }
    return interaction.editReply({ content: summary });
  },
};

