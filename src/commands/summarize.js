const { SlashCommandBuilder, ChannelType } = require('discord.js');
// node-fetch v3 is ESM-only; dynamic import for CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
const OPENAI_SUMMARY_MODEL = process.env.SUMMARIZE_MODEL || 'gpt-4o-mini';

const MAX_INPUT_CHARS = 16000; // practical cap before sending to API

module.exports = {
  data: new SlashCommandBuilder()
    .setName('summarize')
    .setDescription('Summarize the last N messages in this channel')
    .addIntegerOption(opt =>
      opt.setName('count')
        .setDescription('How many recent messages to analyze (max 100)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addStringOption(opt =>
      opt.setName('length')
        .setDescription('Desired summary length')
        .addChoices(
          { name: 'short', value: 'short' },
          { name: 'medium', value: 'medium' },
          { name: 'detailed', value: 'detailed' },
        )
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('style')
        .setDescription('Output style')
        .addChoices(
          { name: 'bullets', value: 'bullets' },
          { name: 'paragraph', value: 'paragraph' },
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    // Try to defer; if another instance already acknowledged, quietly bail.
    try {
      await interaction.deferReply({ ephemeral: true });
    } catch (e) {
      const code = e?.code || e?.status;
      const msg = (e?.message || '').toLowerCase();
      if (code === 40060 || code === 10062 || msg.includes('already been acknowledged') || msg.includes('unknown interaction')) {
        return; // another process handled this interaction
      }
      throw e;
    }

    if (!OPENAI_API_KEY) {
      return interaction.editReply('OpenAI API key not configured. Set OPENAI_API_KEY in your environment.');
    }

    const count = interaction.options.getInteger('count') ?? 50;
    const lengthPref = interaction.options.getString('length') || 'short';
    const style = interaction.options.getString('style') || 'paragraph';

    // Ensure we're in a text-capable channel
    const channel = interaction.channel;
    if (!channel || ![
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.GuildAnnouncement
    ].includes(channel.type)) {
      return interaction.editReply('This command can only run in a text channel or thread.');
    }

    // Fetch recent messages
    let fetched;
    try {
      fetched = await channel.messages.fetch({ limit: Math.min(100, Math.max(1, count)) });
    } catch (err) {
      return interaction.editReply(`Could not fetch recent messages: ${err.message}`);
    }

    if (!fetched || fetched.size === 0) {
      return interaction.editReply('No recent messages found to summarize.');
    }

    // Build a plain-text transcript from oldest -> newest
    const ordered = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const sanitize = (s) => {
      if (!s) return '';
      // Replace user/channel/role mentions with readable forms
      return String(s)
        .replace(/<@!?(\d+)>/g, '[@$1]')
        .replace(/<@&(\d+)>/g, '[@role:$1]')
        .replace(/<#(\d+)>/g, '[#channel:$1]');
    };

    let transcript = '';
    for (const m of ordered) {
      const author = m.author?.bot ? `${m.author.username} [bot]` : m.author?.username || 'Unknown';
      const content = sanitize(m.content);
      const attachments = m.attachments?.size ? ` [attachments: ${[...m.attachments.values()].map(a => a.name).filter(Boolean).join(', ')}]` : '';
      const line = content?.trim() ? `${author}: ${content}${attachments}` : (attachments ? `${author}:${attachments}` : '');
      if (line) transcript += `${line}\n`;
      // Stop if transcript is getting very large
      if (transcript.length > MAX_INPUT_CHARS * 1.5) break;
    }

    if (!transcript.trim()) {
      return interaction.editReply('Recent messages have no textual content to summarize.');
    }

    // Truncate to reasonable size
    let truncated = transcript.trim();
    let truncatedNote = '';
    if (truncated.length > MAX_INPUT_CHARS) {
      truncated = truncated.slice(0, MAX_INPUT_CHARS);
      truncatedNote = `\n\n(Note: Input truncated to ${MAX_INPUT_CHARS} characters for processing.)`;
    }

    const styleHint = style === 'bullets'
      ? 'Provide a concise bullet list. Use "- " for each bullet.'
      : 'Provide a concise paragraph summary.';

    const lengthHint = (
      lengthPref === 'detailed' ? 'Aim for a detailed summary.' :
      lengthPref === 'medium' ? 'Aim for a medium-length summary.' :
      'Aim for a very short summary.'
    );

    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that summarizes content faithfully and concisely. Do not invent facts.'
      },
      {
        role: 'user',
        content: `${lengthHint} ${styleHint}\n\nSummarize the following chat transcript. Focus on key topics, decisions, action items, and sentiment. Do not include user IDs.\n\n${truncated}`
      }
    ];

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENAI_SUMMARY_MODEL,
          messages,
          temperature: 0.2,
        })
      });

      const text = await resp.text();
      if (!resp.ok) {
        let msg = text;
        try { msg = JSON.parse(text)?.error?.message || msg; } catch (_) {}
        throw new Error(msg);
      }
      const data = JSON.parse(text);
      const out = data?.choices?.[0]?.message?.content?.trim();
      if (!out) throw new Error('No summary returned.');

      const finalMsg = `${out}${truncatedNote}`;

      if (finalMsg.length <= 2000) {
        return interaction.editReply(finalMsg);
      }
      // Chunk if needed
      await interaction.editReply('Summary is long; sending in parts below:');
      for (let i = 0; i < finalMsg.length; i += 2000) {
        const chunk = finalMsg.slice(i, i + 2000);
        try { await interaction.followUp({ content: chunk, ephemeral: true }); } catch (_) {}
      }
    } catch (err) {
      const msg = err?.message || String(err);
      try {
        await interaction.editReply(`Failed to summarize: ${msg}`);
      } catch (_) {
        try { await interaction.followUp({ content: `Failed to summarize: ${msg}`, ephemeral: true }); } catch (_) {}
      }
    }
  },
};
