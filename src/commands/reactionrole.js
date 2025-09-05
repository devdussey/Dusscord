const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create an embed with a role selection menu')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Post a role selection embed with a select menu')
        // REQUIRED FIRST (Discord API requires required options before optional ones)
        .addRoleOption(opt => opt.setName('role1').setDescription('Role option 1').setRequired(true))
        // Optional role slots
        .addRoleOption(opt => opt.setName('role2').setDescription('Role option 2').setRequired(false))
        .addRoleOption(opt => opt.setName('role3').setDescription('Role option 3').setRequired(false))
        .addRoleOption(opt => opt.setName('role4').setDescription('Role option 4').setRequired(false))
        .addRoleOption(opt => opt.setName('role5').setDescription('Role option 5').setRequired(false))
        .addRoleOption(opt => opt.setName('role6').setDescription('Role option 6').setRequired(false))
        .addRoleOption(opt => opt.setName('role7').setDescription('Role option 7').setRequired(false))
        .addRoleOption(opt => opt.setName('role8').setDescription('Role option 8').setRequired(false))
        .addRoleOption(opt => opt.setName('role9').setDescription('Role option 9').setRequired(false))
        .addRoleOption(opt => opt.setName('role10').setDescription('Role option 10').setRequired(false))
        // Optional metadata after required
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post in (defaults to here)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('title')
            .setDescription('Embed title')
            .setRequired(false)
        )
        .addStringOption(opt =>
          opt.setName('description')
            .setDescription('Embed description')
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('min_select')
            .setDescription('Minimum roles selectable (default 0)')
            .setMinValue(0)
            .setMaxValue(25)
            .setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('max_select')
            .setDescription('Maximum roles selectable (default 1)')
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'You need Manage Roles to create reaction role menus.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    if (sub !== 'create') {
      return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const title = interaction.options.getString('title') || 'Choose your roles';
    const description = interaction.options.getString('description') || 'Use the selector below to choose your roles.';
    const minSelect = interaction.options.getInteger('min_select') ?? 0;
    const maxSelect = interaction.options.getInteger('max_select') ?? 1;

    const roleOptions = [];
    for (let i = 1; i <= 10; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) roleOptions.push(role);
    }
    if (!roleOptions.length) {
      return interaction.reply({ content: 'Provide at least one role.', ephemeral: true });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'I need Manage Roles to assign roles from the menu.', ephemeral: true });
    }
    for (const role of roleOptions) {
      if (role.managed) {
        return interaction.reply({ content: `I cannot manage the role ${role} as it is managed by an integration.`, ephemeral: true });
      }
      if (me.roles.highest.comparePositionTo(role) <= 0) {
        return interaction.reply({ content: `My highest role must be above ${role} to assign it.`, ephemeral: true });
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description);
    try {
      const { applyDefaultColour } = require('../utils/guildColourStore');
      applyDefaultColour(embed, interaction.guildId);
    } catch (err) { console.error('src/commands/reactionrole.js', err);
      // fallback stays uncoloured if util import fails
    }

    const menu = new StringSelectMenuBuilder()
      .setCustomId('rr:select')
      .setPlaceholder('Select roles')
      .setMinValues(Math.min(minSelect, roleOptions.length))
      .setMaxValues(Math.min(maxSelect, roleOptions.length))
      .addOptions(roleOptions.map(r => ({ label: r.name, value: r.id })));

    const row = new ActionRowBuilder().addComponents(menu);

    try {
      const msg = await channel.send({ embeds: [embed], components: [row] });
      if (channel.id !== interaction.channel.id) {
        await interaction.reply({ content: `Reaction role menu posted in ${channel}.`, ephemeral: true });
      } else {
        await interaction.reply({ content: 'Reaction role menu created.', ephemeral: true });
      }
      return msg;
    } catch (err) {
      return interaction.reply({ content: `Failed to post in ${channel}: ${err.message}`, ephemeral: true });
    }
  },
};
