const { SlashCommandBuilder } = require('discord.js');
const { transcribeAttachment, MAX_BYTES } = require('../utils/whisper');
const { createFieldEmbeds } = require('../utils/embedFields');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transcribe')
    .setDescription('Transcribe an audio file using OpenAI')
    .addAttachmentOption(opt =>
      opt.setName('audio')
        .setDescription('Audio file to transcribe (mp3, wav, m4a, ogg, webm)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('prompt')
        .setDescription('Optional context/prompt to guide transcription')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment('audio');
    if (!attachment) {
      return interaction.editReply('Please attach an audio file.');
    }

    try {
      if (typeof attachment.size === 'number' && attachment.size > MAX_BYTES) {
        return interaction.editReply(`File is too large (${Math.round(attachment.size / (1024*1024))}MB). Max allowed is ${MAX_BYTES / (1024*1024)}MB.`);
      }
    } catch (_) {}

    const prompt = interaction.options.getString('prompt') || undefined;

    try {
      const text = await transcribeAttachment(attachment, prompt);
      const embeds = createFieldEmbeds({
        title: 'Transcript',
        user: interaction.user,
        sections: [
          { name: 'Content', value: text }
        ]
      }).map(embed => embed.toJSON());

      if (!embeds.length) {
        return interaction.editReply('Transcript was empty.');
      }

      const [first, ...rest] = embeds;
      await interaction.editReply({ embeds: [first] });
      for (const embed of rest) {
        try {
          await interaction.followUp({ embeds: [embed], ephemeral: true });
        } catch (_) {}
      }
    } catch (err) {
      const msg = err?.message || String(err);
      try {
        await interaction.editReply(`Failed to transcribe audio: ${msg}`);
      } catch (_) {
        try { await interaction.followUp({ content: `Failed to transcribe audio: ${msg}`, ephemeral: true }); } catch (_) {}
      }
    }
  },
};
