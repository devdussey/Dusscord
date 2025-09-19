const { Events, MessageFlags } = require('discord.js');
const { transcribeAttachment, MAX_BYTES } = require('../utils/whisper');
const voiceAutoStore = require('../utils/voiceAutoStore');

const HAS_OPENAI_KEY = Boolean(process.env.OPENAI_API_KEY || process.env.OPENAI_API);

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message.guild) return;
      if (message.author?.bot) return;
      if (!message.flags?.has(MessageFlags.IsVoiceMessage)) return;

      if (!HAS_OPENAI_KEY) return;

      if (!message.channelId) return;
      const enabled = await voiceAutoStore.isChannelEnabled(message.guildId, message.channelId);
      if (!enabled) return;

      const attachment = message.attachments.first();
      if (!attachment) return;

      if (typeof attachment.size === 'number' && attachment.size > MAX_BYTES) {
        try { await message.reply(`Voice message is too large to transcribe (max ${MAX_BYTES / (1024*1024)}MB).`); } catch (_) {}
        return;
      }

      const text = await transcribeAttachment(attachment);
      const MAX_DISCORD = 2000;
      if (text.length <= MAX_DISCORD) {
        try { await message.reply(`Transcript:\n${text}`); } catch (_) {}
        return;
      }

      try { await message.reply('Transcript is long; sending in parts below:'); } catch (_) {}
      for (let i = 0; i < text.length; i += MAX_DISCORD) {
        const chunk = text.slice(i, i + MAX_DISCORD);
        try { await message.channel.send(chunk); } catch (_) {}
      }
    } catch (err) {
      try {
        await message.reply('Sorry, I could not transcribe that voice message.');
      } catch (_) {}
      console.error('Voice transcription failed:', err);
    }
  }
};
