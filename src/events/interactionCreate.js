const { Events } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

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
                        .setTimestamp();

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
