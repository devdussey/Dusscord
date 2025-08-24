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
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}:`, error);

                const errorMessage = 'There was an error while executing this command!';
                
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: errorMessage, ephemeral: true });
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    }
                } catch (replyError) {
                    if (replyError.code === 40060) {
                        console.warn('Interaction timed out - could not send error message to user. This is expected behavior for slow commands.');
                    } else {
                        console.error('Failed to send error message to user:', replyError);
                    }
                    // Bot continues running without crashing
                }
            }
        }
        
        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'embedBuilderModal') {
                await interaction.deferReply();
                
                const title = interaction.fields.getTextInputValue('embedTitle');
                const description = interaction.fields.getTextInputValue('embedDescription');
                const color = interaction.fields.getTextInputValue('embedColor') || '#0099ff';
                const image = interaction.fields.getTextInputValue('embedImage');
                const footer = interaction.fields.getTextInputValue('embedFooter');

                try {
                    const embed = new EmbedBuilder()
                        .setColor(color)
                        .setTimestamp();

                    if (title) embed.setTitle(title);
                    if (description) embed.setDescription(description);
                    if (image) embed.setImage(image);
                    
                    if (footer) {
                        embed.setFooter({ text: footer });
                    } else {
                        embed.setFooter({ 
                            text: `Created by ${interaction.user.displayName}`, 
                            iconURL: interaction.user.displayAvatarURL() 
                        });
                    }

                    await interaction.editReply({
                        content: '✅ Your embed has been created!',
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