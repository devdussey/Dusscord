const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with the bot'),

    async execute(interaction) {
        const helpEmbed = new EmbedBuilder()
            .setTitle('Bot Help')
            .setDescription('Overview of available commands')
            .setColor('#0099ff')
            .addFields(
                { name: '/embed create', value: 'Open a modal to build a custom embed interactively.', inline: false },
                { name: '/embed quick', value: 'Quick embed with options: description, title, color, image, thumbnail, channel.', inline: false },
                { name: '/getembed', value: 'Get embed data from a message by channel ID and message ID.', inline: false },
                { name: '/clone emoji', value: 'Clone a custom emoji to this server by mention/ID/CDN URL. Requires Manage Emojis & Stickers.', inline: false },
                { name: '/clone sticker', value: 'Clone a sticker by ID/URL or upload a file. Requires Manage Emojis & Stickers.', inline: false },
                { name: '/enlarge emoji', value: 'Post a large version of a custom emoji at the chosen size.', inline: false },
                { name: '/enlarge sticker', value: 'Post a sticker file from ID/URL/upload.', inline: false },
                { name: '/autoroles add/remove/list/clear', value: 'Configure roles to auto-assign on member join. Requires Manage Roles.', inline: false },
                { name: '/role add/remove', value: 'Add or remove a specific role from a member. Requires Manage Roles.', inline: false },
                { name: '/mute', value: 'Timeout a member for a set duration (e.g., 10m, 1h) with a reason. Requires Moderate Members.', inline: false },
                { name: '/kick', value: 'Kick a member with a required reason. Requires Kick Members.', inline: false },
                { name: '/ban', value: 'Ban a user with a required reason; optional prune_days (0–7). Requires Ban Members.', inline: false },
                { name: '/purge', value: 'Delete 1–100 recent messages in the current channel (can’t delete older than 14 days). Requires Manage Messages.', inline: false },
                { name: '/removebg', value: 'Remove background from an image via API (requires configured API key).', inline: false },
                { name: '/logchannels', value: 'logging', inline: false },
                { name: '/botinfo', value: 'Show which bot instance responded and environment details.', inline: false },
                { name: '/securitylog set/clear/show', value: 'Set a per‑guild channel for permission/hierarchy violation logs (falls back to DM owners).', inline: false },
                { name: '/securityreport', value: 'See who has triggered denied/hierarchy/missing-command events in the last days.', inline: false },
                { name: '/joins leaderboard', value: 'Show top joiners/leavers (supports lookback window).', inline: false },
                { name: '/joins user', value: 'Show join/leave stats for a specific member.', inline: false },
                { name: '/joins setlog', value: 'Link your existing join/leave log channel and keywords.', inline: false },
                { name: '/joins backfill', value: 'Scan the linked channel and import historical join/leave events.', inline: false },
                { name: '/dmdiag test', value: 'Tests the Bots Direct Message System and Blacklisted Roles', inline: false },
                { name: '/dmdiag role', value: 'Tests the Bots Direct Message System and Blacklisted Roles', inline: false },
                { name: '/adminlist', value: '\u200B', inline: false },
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.client.user.displayAvatarURL()
            });

        try {
            await interaction.reply({ embeds: [helpEmbed] });
        } catch (err) {
            // Fallback if the interaction has expired
            try {
                if (interaction.channel && interaction.channel.send) {
                    await interaction.channel.send({ content: `Here you go, <@${interaction.user.id}>:`, embeds: [helpEmbed] });
                }
            } catch (_) {
                // swallow
            }
        }
    },
};
