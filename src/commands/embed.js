const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
                .addStringOption(option =>
                    option
                        .setName('title')
                        .setDescription('Embed title')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Embed description')
                        .setRequired(true)
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
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'create') {
            // Show modal for interactive embed creation
            const modal = createEmbedModal();
            await interaction.showModal(modal);
        } else if (subcommand === 'quick') {
            await interaction.deferReply();
            
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const color = interaction.options.getString('color') || '#0099ff';
            const image = interaction.options.getString('image');
            const thumbnail = interaction.options.getString('thumbnail');

            try {
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(color)
                    .setTimestamp()
                    .setFooter({ 
                        text: `Created by ${interaction.user.displayName}`, 
                        iconURL: interaction.user.displayAvatarURL() 
                    });

                if (image) embed.setImage(image);
                if (thumbnail) embed.setThumbnail(thumbnail);

                await interaction.editReply({
                    content: '✅ Here\'s your embed:',
                    embeds: [embed]
                });
            } catch (error) {
                await interaction.editReply({
                    content: '❌ Error creating embed. Please check your inputs (especially URLs and color format).'
                });
            }
        }
    },
};