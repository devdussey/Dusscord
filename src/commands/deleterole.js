const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deleterole')
    .setDescription('Delete a role from this server')
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Role to delete')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('reason')
        .setDescription('Reason (for audit log)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'I need the Manage Roles permission.', ephemeral: true });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'You need Manage Roles to use this command.', ephemeral: true });
    }

    const role = interaction.options.getRole('role', true);
    const reasonRaw = interaction.options.getString('reason')?.trim() || 'No reason provided';
    const reason = `By ${interaction.user.tag} (${interaction.user.id}) | ${reasonRaw}`.slice(0, 512);

    // Basic safety checks
    if (role.id === interaction.guild.id) {
      return interaction.reply({ content: 'You cannot delete the @everyone role.', ephemeral: true });
    }
    if (role.managed) {
      return interaction.reply({ content: 'That role is managed by an integration and cannot be deleted.', ephemeral: true });
    }
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      return interaction.reply({ content: 'My highest role must be above the target role to delete it.', ephemeral: true });
    }
    if (interaction.member.roles.highest.comparePositionTo(role) <= 0 && interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: 'Your highest role must be above the target role to delete it.', ephemeral: true });
    }

    try {
      const name = role.name;
      await role.delete({ reason });
      return interaction.reply({ content: `Deleted role "${name}".`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `Failed to delete role: ${err.message || 'Unknown error'}`, ephemeral: true });
    }
  },
};

