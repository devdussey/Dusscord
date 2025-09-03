const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
// node-fetch v3 is ESM-only; use dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const REMOVE_BG_API_KEY = 'YOUR_REMOVE_BG_API_KEY'; // Replace with your actual key

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removebg')
        .setDescription('Remove the background from an image')
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('Attach an image to process')
                .setRequired(false)
        )
         .addStringOption(option =>
            option.setName('image_url')
                .setDescription('URL of the image to process')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        let imageUrl = interaction.options.getString('image_url');

        // Check for attachment if no URL is provided
        if (!imageUrl) {
            const attachment = interaction.options.getAttachment?.('image');
            if (attachment) {
                imageUrl = attachment.url;
            } else if (interaction.options._hoistedOptions) {
                // For Discord.js v14, attachments are in _hoistedOptions
                const fileAttachment = interaction.options._hoistedOptions.find(opt => opt.attachment);
                if (fileAttachment) imageUrl = fileAttachment.attachment.url;
            }
        }

        // If still no image, check message attachments (for context menu or fallback)
        if (!imageUrl && interaction.targetMessage?.attachments?.size) {
            imageUrl = interaction.targetMessage.attachments.first().url;
        }

        if (!imageUrl) {
            await interaction.editReply('Please provide an image URL or attach an image.');
            return;
        }

        try {
            const response = await fetch('https://api.remove.bg/v1.0/removebg', {
                method: 'POST',
                headers: {
                    'X-Api-Key': REMOVE_BG_API_KEY
                },
                body: new URLSearchParams({
                    image_url: imageUrl,
                    size: 'auto'
                })
            });

            if (!response.ok) {
                throw new Error('RemoveBG API error');
            }

            const buffer = await response.buffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'no-bg.png' });

            await interaction.editReply({ files: [attachment] });
        } catch (error) {
            await interaction.editReply('Failed to remove background. Please check the image and try again.');
        }
    },
};
