const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
// node-fetch v3 is ESM-only; use dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function buildProxyUrl(originalUrl, width, height) {
  const parsed = new URL(originalUrl);
  const path = `${parsed.host}${parsed.pathname}${parsed.search || ''}`;
  const proxied = parsed.protocol === 'https:' ? `ssl:${path}` : path;

  const proxy = new URL('https://images.weserv.nl/');
  proxy.searchParams.set('url', proxied);
  proxy.searchParams.set('output', 'png');
  if (width) proxy.searchParams.set('w', String(width));
  if (height) proxy.searchParams.set('h', String(height));
  proxy.searchParams.set('fit', 'inside');
  proxy.searchParams.set('we', '1');
  return proxy;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('imageresize')
    .setDescription('Resize an image and convert it to PNG')
    .addAttachmentOption(opt =>
      opt
        .setName('image')
        .setDescription('Image attachment to resize')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName('width')
        .setDescription('Target width in pixels (max 4096)')
        .setMinValue(1)
        .setMaxValue(4096)
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName('height')
        .setDescription('Target height in pixels (optional, max 4096). Leave empty to auto-scale.')
        .setMinValue(1)
        .setMaxValue(4096)
        .setRequired(false)
    ),

  async execute(interaction) {
    const attachment = interaction.options.getAttachment('image', true);
    const width = interaction.options.getInteger('width', true);
    const height = interaction.options.getInteger('height');

    if (!attachment.contentType || !attachment.contentType.startsWith('image/')) {
      await interaction.reply({
        content: 'Please provide a valid image attachment.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      const proxyUrl = buildProxyUrl(attachment.url, width, height ?? undefined);
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Proxy response ${response.status}`);
      }

      const buffer = await response.buffer();
      if (!buffer || buffer.length === 0) {
        throw new Error('Received empty image buffer');
      }

      const fileName = `resized-${Date.now()}.png`;
      const file = new AttachmentBuilder(buffer, { name: fileName });

      await interaction.editReply({
        content: `Resized image to ${width}px${height ? ` × ${height}px` : ''} (PNG).`,
        files: [file],
      });
    } catch (error) {
      console.error('Failed to resize image:', error);
      await interaction.editReply({
        content: 'Sorry, I could not resize that image. Please try a different image or dimensions.',
      });
    }
  },
};

