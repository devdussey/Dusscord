const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
// node-fetch v3 is ESM-only; use dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const HF_API_KEY = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;
const MODEL_URL = process.env.HF_SUPERRES_MODEL_URL || 'https://api-inference.huggingface.co/models/ai-forever/Real-ESRGAN';

async function downloadImageBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image (status ${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('The provided link did not return an image file.');
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('Downloaded image was empty.');
  }

  return Buffer.from(arrayBuffer);
}

async function upscaleImage(buffer) {
  if (!HF_API_KEY) {
    throw new Error('Hugging Face API key is not configured. Set HF_API_KEY or HUGGINGFACE_API_KEY.');
  }

  const response = await fetch(MODEL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      'Content-Type': 'application/octet-stream',
      Accept: 'image/png',
    },
    body: buffer,
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let message = `Upscale service error (status ${response.status})`;

    try {
      const text = await response.text();
      if (text) {
        const json = JSON.parse(text);
        if (json.error) {
          message = `Upscale service error: ${json.error}`;
        } else if (json.message) {
          message = `Upscale service error: ${json.message}`;
        }
      }
    } catch (_) {
      // ignore JSON parse failures and fall back to default message
    }

    throw new Error(message);
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('Upscale service returned an empty response.');
  }

  if (contentType.includes('application/json')) {
    try {
      const json = JSON.parse(Buffer.from(arrayBuffer).toString('utf8'));
      if (json.error) {
        throw new Error(`Upscale service error: ${json.error}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Upscale service returned JSON instead of image data.');
    }
  }

  return Buffer.from(arrayBuffer);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('highdef')
    .setDescription('Enhance an image using AI upscaling for higher clarity and resolution')
    .addAttachmentOption(option =>
      option
        .setName('image')
        .setDescription('Attach the image to upscale')
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('image_url')
        .setDescription('URL of the image to upscale')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try { console.log(`[highdef] invoked by ${interaction.user?.id} in ${interaction.guild?.id}`); } catch (_) {}

    let imageUrl = interaction.options.getString('image_url');

    if (!imageUrl) {
      const attachment = interaction.options.getAttachment?.('image');
      if (attachment?.url) {
        imageUrl = attachment.url;
      } else if (interaction.options._hoistedOptions) {
        const fileAttachment = interaction.options._hoistedOptions.find(opt => opt.attachment);
        if (fileAttachment?.attachment?.url) {
          imageUrl = fileAttachment.attachment.url;
        }
      }
    }

    if (!imageUrl && interaction.targetMessage?.attachments?.size) {
      imageUrl = interaction.targetMessage.attachments.first().url;
    }

    if (!imageUrl) {
      await interaction.editReply('Please provide an image URL or attach an image to upscale.');
      return;
    }

    try {
      const original = await downloadImageBuffer(imageUrl);
      const upscaled = await upscaleImage(original);

      const fileName = `highdef-${Date.now()}.png`;
      const attachment = new AttachmentBuilder(upscaled, { name: fileName });

      await interaction.editReply({
        content: 'Here is your enhanced high-definition image!',
        files: [attachment],
      });
    } catch (error) {
      console.error('HighDef command failed:', error);
      await interaction.editReply(`Sorry, I could not upscale that image: ${error.message}`);
    }
  },
};
