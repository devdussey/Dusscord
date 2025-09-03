const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../utils/securityLogger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove roles from a member')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a role to a member')
        .addUserOption(opt =>
          opt.setName('member').setDescription('Member to modify').setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to add').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason (for audit log)').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a role from a member')
        .addUserOption(opt =>
          opt.setName('member').setDescription('Member to modify').setRequired(true)
        )
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to remove').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason (for audit log)').setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    await interaction.deferReply();

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await logger.logPermissionDenied(interaction, 'role ' + interaction.options.getSubcommand(), 'Bot missing Manage Roles');
      return interaction.editReply({ content: 'I need the Manage Roles permission.' });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      await logger.logPermissionDenied(interaction, 'role ' + interaction.options.getSubcommand(), 'User missing Manage Roles');
      return interaction.editReply({ content: 'You need Manage Roles to use this command.' });
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser('member', true);
    const role = interaction.options.getRole('role', true);
    const reasonRaw = interaction.options.getString('reason')?.trim() || 'No reason provided';
    const reason = `By ${interaction.user.tag} (${interaction.user.id}) | ${reasonRaw}`.slice(0, 512);

    // Validate role
    if (role.managed) {
      return interaction.editReply({ content: 'That role is managed and cannot be assigned/removed by bots.' });
    }
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      await logger.logHierarchyViolation(interaction, 'role ' + sub, { tag: role.name, id: role.id }, 'Bot role not high enough');
      return interaction.editReply({ content: 'My highest role must be above the target role.' });
    }
    // Optional: ensure requester outranks the role
    if (interaction.member.roles.highest.comparePositionTo(role) <= 0 && interaction.guild.ownerId !== interaction.user.id) {
      await logger.logHierarchyViolation(interaction, 'role ' + sub, { tag: role.name, id: role.id }, 'Requester role not high enough');
      return interaction.editReply({ content: 'Your highest role must be above the target role.' });
    }

    // Fetch target member
    let member;
    try {
      member = await interaction.guild.members.fetch(user.id);
    } catch (_) {
      return interaction.editReply({ content: 'That user is not in this server.' });
    }

    try {
      if (sub === 'add') {
        if (member.roles.cache.has(role.id)) {
          return interaction.editReply({ content: `${user.tag} already has ${role.toString()}.` });
        }
        await member.roles.add(role, reason);
        return interaction.editReply({ content: `Added ${role.toString()} to ${user.tag}.` });
      } else if (sub === 'remove') {
        if (!member.roles.cache.has(role.id)) {
          return interaction.editReply({ content: `${user.tag} does not have ${role.toString()}.` });
        }
        await member.roles.remove(role, reason);
        return interaction.editReply({ content: `Removed ${role.toString()} from ${user.tag}.` });
      }
    } catch (err) {
      return interaction.editReply({ content: `Failed to update roles: ${err.message || 'Unknown error'}` });
    }

    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};
