const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help with the bot'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });
        
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Drugscord Bot Help')
            .setDescription('Basic Command List')
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
                    name: ' 📎 `/getembed',
                    value: 'Pull the embed code from any embedded message.',
                    inline: false
                },
            )
            .setFooter({ 
                text: 'Need more help? Ask JP',
                iconURL: interaction.client.user.displayAvatarURL()
            })

        await interaction.editReply({ embeds: [helpEmbed] });
    },
};