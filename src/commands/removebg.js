const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
// node-fetch v3 is ESM-only; use dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;
const premiumManager = require('../utils/premiumManager');
const removeBgUsageStore = require('../utils/removeBgUsageStore');

const DAILY_FREE_LIMIT = 2;

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
        const hasPremium = premiumManager.hasPremiumAccess(interaction.guild, interaction.member, interaction.user);
        let usageInfo = null;

        if (!hasPremium) {
            usageInfo = removeBgUsageStore.tryConsume(interaction.user?.id, DAILY_FREE_LIMIT);
            if (!usageInfo.allowed) {
                const message = premiumManager.buildUpsellMessage('Remove Background', {
                    freebiesRemaining: usageInfo.remaining,
                    freebiesTotal: DAILY_FREE_LIMIT,
                    extraNote: 'You have used all of your free remove background uses for today.',
                });
                await interaction.reply({ content: message, ephemeral: true });
                return;
            }
        }

        await interaction.deferReply();

        try { console.log(`[removebg] invoked by ${interaction.user?.id} in ${interaction.guild?.id}`); } catch (_) {}

        if (!REMOVE_BG_API_KEY) {
            await interaction.editReply('RemoveBG API key is not configured. Set REMOVE_BG_API_KEY in your environment.');
            return;
        }

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
            console.log(`[removebg] imageUrl=${imageUrl}`);
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
                const text = await response.text().catch(() => '');
                let msg = 'RemoveBG API error';
                try {
                    const data = JSON.parse(text);
                    msg = data?.errors?.[0]?.title || data?.errors?.[0]?.detail || msg;
                } catch (_) {}
                console.log(`[removebg] error status=${response.status} body=${text?.slice(0,400)}`);
                throw new Error(msg);
            }

            const buffer = await response.buffer();
            const attachment = new AttachmentBuilder(buffer, { name: 'no-bg.png' });

            try {
                await interaction.editReply({ content: 'Background removed:', files: [attachment] });
            } catch (e) {
                try { await interaction.followUp({ content: 'Background removed:', files: [attachment] }); } catch (_) {}
            }

            if (!hasPremium && usageInfo) {
                const note = `Free remove background uses remaining today: ${usageInfo.remaining} of ${DAILY_FREE_LIMIT}.`;
                try { await interaction.followUp({ content: note, ephemeral: true }); } catch (_) {}
            }
        } catch (error) {
            try {
                await interaction.editReply(`Failed to remove background: ${error.message}`);
            } catch (_) {
                try { await interaction.followUp({ content: `Failed to remove background: ${error.message}` }); } catch (_) {}
            }
        }
    },
};
