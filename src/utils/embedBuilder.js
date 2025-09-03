const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

function createEmbedModal(opts = {}) {
    const customId = typeof opts.customId === 'string' && opts.customId.length ? opts.customId : 'embedBuilderModal';
    const titleText = typeof opts.title === 'string' && opts.title.length ? opts.title : 'Embed Builder';
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(titleText);

    const titleInput = new TextInputBuilder()
        .setCustomId('embedTitle')
        .setLabel('Embed Title')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(256)
        .setRequired(false);

    const descriptionInput = new TextInputBuilder()
        .setCustomId('embedDescription')
        .setLabel('Embed Description')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(4000)
        .setRequired(false);

    const colorInput = new TextInputBuilder()
        .setCustomId('embedColor')
        .setLabel('Embed Color (hex code or color name)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(20)
        .setPlaceholder('#0000ff or blue')
        .setRequired(false);

    const imageInput = new TextInputBuilder()
        .setCustomId('embedImage')
        .setLabel('Image URL (optional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    const footerInput = new TextInputBuilder()
        .setCustomId('embedFooter')
        .setLabel('Footer Text (optional)')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(2048)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(footerInput)
    );

    return modal;
}

module.exports = { createEmbedModal };
