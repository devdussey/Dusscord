const { Events, PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle chat input commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                try {
                    const logger = require('../utils/securityLogger');
                    await logger.logMissingCommand(interaction);
                } catch (_) {}
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);

                const errorMessage = 'There was an error while executing this command!';

                // Try to notify the user via the interaction first
                try {
                    if (interaction.replied) {
                        await interaction.followUp({ content: errorMessage, ephemeral: true });
                    } else if (interaction.deferred) {
                        await interaction.editReply({ content: errorMessage });
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    }
                } catch (replyError) {
                    const code = replyError?.code;
                    if (code === 40060 || code === 10062 || code === 10008) {
                        // 40060: Unknown interaction (ack timed out)
                        // 10062: Unknown interaction (webhook invalid/expired)
                        // 10008: Unknown message (@original missing/expired)
                        // Fallback: send a normal message in the channel if possible
                        try {
                            if (interaction.channel && interaction.channel.send) {
                                await interaction.channel.send(`Sorry <@${interaction.user.id}>, there was an error running /${interaction.commandName}.`);
                            }
                        } catch (fallbackErr) {
                            console.error('Failed to send channel fallback message:', fallbackErr);
                        }
                    } else {
                        console.error('Failed to send error message to user:', replyError);
                    }
                    // Continue without crashing
                }
            }
        }
        
        // Handle role selection menus (reaction role)
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'rr:select') {
                if (!interaction.inGuild()) return;
                const me = interaction.guild.members.me;
                if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    try { await interaction.reply({ content: 'I need Manage Roles to update your roles.', ephemeral: true }); } catch (_) {}
                    return;
                }
                let member;
                try { member = await interaction.guild.members.fetch(interaction.user.id); } catch (_) {}
                if (!member) {
                    try { await interaction.reply({ content: 'Could not fetch your member data.', ephemeral: true }); } catch (_) {}
                    return;
                }

                // Determine which roles this menu manages (from the component options)
                const menuRoles = interaction.component?.options?.map(o => o.value).filter(Boolean) || [];
                const selected = interaction.values || [];

                const toAdd = selected.filter(id => !member.roles.cache.has(id));
                const toRemove = menuRoles.filter(id => !selected.includes(id) && member.roles.cache.has(id));

                // Filter by hierarchy and non-managed
                const safeAdd = toAdd.filter(id => {
                    const role = interaction.guild.roles.cache.get(id);
                    return role && !role.managed && me.roles.highest.comparePositionTo(role) > 0;
                });
                const safeRemove = toRemove.filter(id => {
                    const role = interaction.guild.roles.cache.get(id);
                    return role && !role.managed && me.roles.highest.comparePositionTo(role) > 0;
                });

                try {
                    if (safeAdd.length) await member.roles.add(safeAdd, 'Reaction role selection');
                    if (safeRemove.length) await member.roles.remove(safeRemove, 'Reaction role selection');
                    await interaction.reply({ content: 'Your roles have been updated.', ephemeral: true });
                } catch (err) {
                    await interaction.reply({ content: `Failed to update roles: ${err.message}`, ephemeral: true });
                }
                return;
            }
        }
        
        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'embedBuilderModal') {
                await interaction.deferReply();
                
                const title = interaction.fields.getTextInputValue('embedTitle');
                const description = interaction.fields.getTextInputValue('embedDescription');
                const color = interaction.fields.getTextInputValue('embedColor') || '#0000ff';
                const image = interaction.fields.getTextInputValue('embedImage');


                try {
                    const embed = new EmbedBuilder()
                        .setColor(color)
                        ;

                    if (title) embed.setTitle(title);
                    if (description) embed.setDescription(description);
                    if (image) embed.setImage(image);             

                    await interaction.editReply({
                        embeds: [embed]
                    });
                } catch (error) {
                    await interaction.editReply({
                        content: '❌ Error creating embed. Please check your inputs (especially image URL and color format).'
                    });
                }
            }
        }
    },
};
