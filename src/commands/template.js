const { SlashCommandBuilder } = require('discord.js');
const { getEmbedTemplate, listTemplates } = require('../utils/embedTemplates');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('template')
        .setDescription('Use pre-built embed templates')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available embed templates')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('use')
                .setDescription('Use a specific template')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Template name')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option
                        .setName('title')
                        .setDescription('Custom title for the embed')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Custom description for the embed')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'list') {
            await interaction.deferReply({ ephemeral: true });
            
            const templates = listTemplates();
            const templateList = templates.map(t => `**${t.name}** - ${t.description}`).join('\n');
            
            await interaction.editReply({
                content: `📋 **Available Templates:**\n\n${templateList}\n\nUse \`/template use <name>\` to use a template.`
            });
        } else if (subcommand === 'use') {
            await interaction.deferReply();
            
            const templateName = interaction.options.getString('name');
            const customTitle = interaction.options.getString('title');
            const customDescription = interaction.options.getString('description');

            try {
                const embed = getEmbedTemplate(templateName, {
                    title: customTitle,
                    description: customDescription,
                    user: interaction.user
                });

                if (!embed) {
                    await interaction.editReply({
                        content: '❌ Template not found. Use `/template list` to see available templates.'
                    });
                    return;
                }

                await interaction.editReply({
                    content: `✅ Using template: **${templateName}**`,
                    embeds: [embed]
                });
            } catch (error) {
                await interaction.editReply({
                    content: '❌ Error creating embed from template.'
                });
            }
        }
    },

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const templates = listTemplates();
        const filtered = templates.filter(template => 
            template.name.toLowerCase().includes(focusedValue.toLowerCase())
        );

        await interaction.respond(
            filtered.slice(0, 25).map(template => ({
                name: template.name,
                value: template.name
            }))
        );
    },
};