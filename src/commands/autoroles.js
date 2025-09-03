const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const logger = require('../utils/securityLogger');
const store = require('../utils/autorolesStore');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoroles')
        .setDescription('Configure automatic roles for new members')
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Add a role to autoroles')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role to auto-assign on join')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Remove a role from autoroles')
                .addRoleOption(opt =>
                    opt.setName('role')
                        .setDescription('Role to remove')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('List current autoroles')
        )
        .addSubcommand(sub =>
            sub
                .setName('clear')
                .setDescription('Clear all autoroles')
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
        }

        const me = interaction.guild.members.me;
        if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            await logger.logPermissionDenied(interaction, 'autoroles', 'Bot missing Manage Roles');
            return interaction.reply({ content: 'I need the Manage Roles permission.', ephemeral: true });
        }

        // Require user permission as well
        if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
            await logger.logPermissionDenied(interaction, 'autoroles', 'User missing Manage Roles');
            return interaction.reply({ content: 'You need Manage Roles to configure autoroles.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const role = interaction.options.getRole('role', true);

            // Validate role is assignable by bot
            if (role.managed) {
                await logger.logHierarchyViolation(interaction, 'autoroles add', { tag: role.name, id: role.id }, 'Managed role');
                return interaction.reply({ content: 'That role is managed and cannot be assigned by bots.', ephemeral: true });
            }
            if (me.roles.highest.comparePositionTo(role) <= 0) {
                await logger.logHierarchyViolation(interaction, 'autoroles add', { tag: role.name, id: role.id }, 'Bot role not high enough');
                return interaction.reply({ content: 'My role must be higher than the target role.', ephemeral: true });
            }

            const added = store.addGuildRole(interaction.guild.id, role.id);
            return interaction.reply({ content: added ? `Added <@&${role.id}> to autoroles.` : `<@&${role.id}> is already in autoroles.`, ephemeral: true });
        }

        if (sub === 'remove') {
            const role = interaction.options.getRole('role', true);
            const removed = store.removeGuildRole(interaction.guild.id, role.id);
            return interaction.reply({ content: removed ? `Removed <@&${role.id}> from autoroles.` : `<@&${role.id}> was not in autoroles.`, ephemeral: true });
        }

        if (sub === 'list') {
            const ids = store.getGuildRoles(interaction.guild.id);
            if (!ids.length) {
                return interaction.reply({ content: 'No autoroles configured.', ephemeral: true });
            }
            const names = ids.map(id => interaction.guild.roles.cache.get(id) ? `<@&${id}>` : `Unknown(${id})`);
            return interaction.reply({ content: `Autoroles: ${names.join(', ')}`, ephemeral: true });
        }

        if (sub === 'clear') {
            store.clearGuildRoles(interaction.guild.id);
            return interaction.reply({ content: 'Cleared all autoroles for this server.', ephemeral: true });
        }

        return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    },
};
