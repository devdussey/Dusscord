const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getembed')
        .setDescription('Gets embed data from a specific message')
        .addStringOption(option =>
            option.setName('channelid')
                  .setDescription('ID of the channel')
                  .setRequired(true))
        .addStringOption(option =>
            option.setName('messageid')
                  .setDescription('ID of the message containing the embed')
                  .setRequired(true)),

    async execute(interaction) {
        const channelId = interaction.options.getString('channelid');
        const messageId = interaction.options.getString('messageid');

        const channel = await interaction.client.channels.fetch(channelId);
        if (!channel) return interaction.reply({ content: 'Channel not found.', ephemeral: true });

        const message = await channel.messages.fetch(messageId);
        if (!message) return interaction.reply({ content: 'Message not found.', ephemeral: true });

        if (message.embeds.length === 0) {
            return interaction.reply({ content: 'No embeds found in that message.', ephemeral: true });
        }

        const embed = message.embeds[0]; // Get the first embed

        // Output embed data as JSON or plain text
        const embedData = {
            title: embed.title || 'None',
            description: embed.description || 'None',
            fields: embed.fields.length > 0 ? embed.fields : 'None',
            color: embed.hexColor || 'None',
            footer: embed.footer ? embed.footer.text : 'None',
            image: embed.image ? embed.image.url : 'None',
            thumbnail: embed.thumbnail ? embed.thumbnail.url : 'None',
        };

        await interaction.reply({ content: `Embed data:\n\`\`\`json\n${JSON.stringify(embedData, null, 2)}\`\`\`` });
    },
};
