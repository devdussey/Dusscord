const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with the embed bot'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Embed Bot Help')
            .setDescription('I help you create beautiful Discord embeds easily!')
            .setColor('#0099ff')
            .addFields(
                {
                    name: '📝 `/embed create`',
                    value: 'Opens an interactive form to create custom embeds with all options.',
                    inline: false
                },
                {
                    name: '⚡ `/embed quick`',
                    value: 'Quickly create an embed with basic options like title, description, and color.',
                    inline: false
                },
                {
                    name: '📋 `/template list`',
                    value: 'See all available pre-built embed templates.',
                    inline: false
                },
                {
                    name: '🎨 `/template use`',
                    value: 'Use a pre-built template (announcement, welcome, poll, etc.).',
                    inline: false
                },
                {
                    name: '💡 Tips',
                    value: '• Colors can be hex codes (#ff0000) or names (red)\n• Use valid URLs for images\n• Templates save you time for common embeds\n• All embeds include timestamps automatically',
                    inline: false
                }
            )
            .setFooter({ 
                text: 'Need more help? Check the documentation or ask an admin!',
                iconURL: interaction.client.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [helpEmbed] });
    },
};