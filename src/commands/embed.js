const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { createEmbedModal } = require('../utils/embedBuilder');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create a custom embed')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new embed with a step-by-step builder')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('quick')
                .setDescription('Quickly create an embed')
                // Required options must come before non-required ones
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Embed description')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('title')
                        .setDescription('Embed title')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('color')
                        .setDescription('Embed color (hex code like #ff0000 or color name)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('image')
                        .setDescription('Image URL')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('thumbnail')
                        .setDescription('Thumbnail URL')
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel to send the embed to')
                        .addChannelTypes(ChannelType.GuildText) // Only allow text channels
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'create') {
            // Show modal for interactive embed creation
            const modal = createEmbedModal();
            await interaction.showModal(modal);

        } else if (subcommand === 'quick') {
            await interaction.deferReply({ ephemeral: true }); // silent, only user sees this

            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const color = interaction.options.getString('color') || '#0099ff';
            const image = interaction.options.getString('image');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            try {
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(color)
                    .setImage(image)
                  
                // Send the embed to the chosen channel
                await targetChannel.send({ embeds: [embed] });

                // Let the user know privately it worked
                await interaction.editReply({
                    content: `✅ Your embed has been sent to ${targetChannel}.`
                });

            } catch (error) {
                console.error(error);
                await interaction.editReply({
                    content: '❌ Error creating embed. Please check your inputs (especially URLs and color format).'
                });
            }
        }
    },
};
