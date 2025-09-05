const { SlashCommandBuilder } = require('discord.js');
// node-fetch v3 is ESM-only; use dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
let FormDataCtor = null;
try {
  // Prefer Node 18+ global FormData
  if (typeof FormData !== 'undefined') {
    FormDataCtor = FormData;
  }
} catch (err) { console.error('src/commands/transcribe.js', err); }
if (!FormDataCtor) {
  try {
    // Fallback to form-data package (CommonJS)
    FormDataCtor = require('form-data');
  } catch (err) {
    // Will be handled at runtime with a helpful error
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
const OPENAI_TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || 'whisper-1';

// Discord hard limit for attachments is above this, but OpenAI Whisper API commonly allows ~25MB
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

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

    if (!OPENAI_API_KEY) {
      return interaction.editReply('OpenAI API key not configured. Set OPENAI_API_KEY in your environment.');
    }

    if (!FormDataCtor) {
      return interaction.editReply('Missing FormData implementation. Please install the "form-data" package or run on Node 18+.');
    }

    const attachment = interaction.options.getAttachment('audio');
    if (!attachment) {
      return interaction.editReply('Please attach an audio file.');
    }

    // Basic size check (if available)
    try {
      if (typeof attachment.size === 'number' && attachment.size > MAX_BYTES) {
        return interaction.editReply(`File is too large (${Math.round(attachment.size / (1024*1024))}MB). Max allowed is ${MAX_BYTES / (1024*1024)}MB.`);
      }
    } catch (err) { console.error('src/commands/transcribe.js', err); }

    // Basic content-type filter (allow common audio types but don’t hard-block if missing)
    const ct = (attachment.contentType || '').toLowerCase();
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a'];
    if (ct && !allowed.some(a => ct.includes(a.split('/')[1]) || ct === a)) {
      // Continue, but warn in logs
      try { console.log(`[transcribe] Unrecognized content-type: ${ct}`); } catch (err) { console.error('src/commands/transcribe.js', err); }
    }

    const prompt = interaction.options.getString('prompt') || undefined;

    try {
      // 1) Download the file from Discord CDN
      const fileRes = await fetch(attachment.url);
      if (!fileRes.ok) {
        const text = await fileRes.text().catch(() => '');
        throw new Error(`Failed to download attachment: ${fileRes.status} ${text?.slice(0,200)}`);
      }
      const audioBuffer = Buffer.from(await fileRes.arrayBuffer());

      if (audioBuffer.length > MAX_BYTES) {
        return interaction.editReply(`Downloaded file exceeds ${MAX_BYTES / (1024*1024)}MB after fetch.`);
      }

      const fileName = attachment.name || 'audio';
      const mimeType = ct || 'application/octet-stream';

      // 2) Build multipart form data for OpenAI
      const form = new FormDataCtor();
      // form-data (package) needs explicit options; Node18 FormData accepts Blob/Buffer
      if (form.append.length >= 3) {
        // Likely form-data package signature: append(name, value, options)
        form.append('file', audioBuffer, { filename: fileName, contentType: mimeType });
      } else {
        // Likely undici FormData: append(name, Blob, filename?)
        let blob;
        try {
          const { Blob } = require('buffer');
          blob = new Blob([audioBuffer], { type: mimeType });
        } catch (err) { console.error('src/commands/transcribe.js', err);
          // Fallback: submit buffer directly; undici supports Buffer as body part
          blob = audioBuffer;
        }
        form.append('file', blob, fileName);
      }
      form.append('model', OPENAI_TRANSCRIBE_MODEL);
      if (prompt) form.append('prompt', prompt);
      // You can also set language if desired: form.append('language', 'en');

      // 3) Call OpenAI Transcriptions API
      const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          // Do NOT set content-type manually; let FormData set the proper boundary
        },
        body: form,
      });

      const bodyText = await resp.text();
      if (!resp.ok) {
        let msg = bodyText;
        try { msg = (JSON.parse(bodyText)?.error?.message) || msg; } catch (err) { console.error('src/commands/transcribe.js', err); }
        throw new Error(`OpenAI API error: ${resp.status} ${msg}`);
      }

      let data;
      try { data = JSON.parse(bodyText); } catch (err) { console.error('src/commands/transcribe.js', err);
        // Some clients can request text responses; attempt soft parse
        data = { text: bodyText };
      }

      const text = String(data.text || '').trim();
      if (!text) {
        return interaction.editReply('Transcription returned no text.');
      }

      // Discord message limit: 2000 chars; chunk if necessary
      const MAX_DISCORD = 2000;
      if (text.length <= MAX_DISCORD) {
        return interaction.editReply(`Transcript:\n${text}`);
      }

      // Send in chunks
      await interaction.editReply('Transcript is long; sending in parts below:');
      for (let i = 0; i < text.length; i += MAX_DISCORD) {
        const chunk = text.slice(i, i + MAX_DISCORD);
        // Follow-up to avoid editing the same message repeatedly
        // Try ephemeral followUp (works because initial reply was ephemeral)
        try { await interaction.followUp({ content: chunk, ephemeral: true }); } catch (err) { console.error('src/commands/transcribe.js', err); }
      }
    } catch (err) {
      const msg = err?.message || String(err);
      try {
        await interaction.editReply(`Failed to transcribe audio: ${msg}`);
      } catch (err) { console.error('src/commands/transcribe.js', err);
        try { await interaction.followUp({ content: `Failed to transcribe audio: ${msg}`, ephemeral: true }); } catch (err) { console.error('src/commands/transcribe.js', err); }
      }
    }
  },
};

