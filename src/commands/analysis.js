const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { createFieldEmbeds } = require('../utils/embedFields');
const {
  getPersona,
  consumeJudgementToken,
  refundJudgementToken,
} = require('../utils/analysisConfigStore');

const OPENAI_API_KEY = process.env.OPENAI_ANALYSIS_KEY || process.env.OPENAI_API_KEY || process.env.OPENAI_API;
const OPENAI_ANALYSIS_MODEL = process.env.ANALYSIS_MODEL || process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-mini';

const MAX_FETCH_MESSAGES = 1000;
const MAX_TRANSCRIPT_CHARS = 16000;
const DEFAULT_PERSONA = 'You are the Dusscord analysis persona. Provide accurate, structured insights about conversations without inventing facts.';

const fetchApi = (...args) => {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch(...args);
  }
  return import('node-fetch').then(({ default: fetch }) => fetch(...args));
};

function buildAnalysisSections(text) {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/);
  const sections = [];
  let currentName = null;
  let buffer = [];

  const flush = () => {
    if (!currentName) return;
    const value = buffer.join('\n').trim();
    if (value) {
      sections.push({ name: currentName, value });
    }
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine ?? '';
    const hashHeading = line.match(/^\s*#+\s*(.+)$/);
    if (hashHeading) {
      flush();
      currentName = hashHeading[1].trim() || 'Analysis';
      continue;
    }
    const colonHeading = line.match(/^\s*([^:#]{2,}):\s*$/);
    if (colonHeading) {
      flush();
      currentName = colonHeading[1].trim() || 'Analysis';
      continue;
    }
    if (!currentName) currentName = 'Analysis';
    buffer.push(line);
  }

  flush();
  if (!sections.length) {
    const fallback = String(text).trim();
    if (fallback) return [{ name: 'Analysis', value: fallback }];
  }
  return sections;
}

function sanitizeContent(input) {
  if (!input) return '';
  return String(input)
    .replace(/<@!?(\d+)>/g, '[@$1]')
    .replace(/<@&(\d+)>/g, '[@role:$1]')
    .replace(/<#(\d+)>/g, '[#channel:$1]');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analysis')
    .setDescription('Analyze recent channel messages with the configured analysis persona')
    .addIntegerOption((opt) =>
      opt
        .setName('count')
        .setDescription('How many recent messages to analyze (max 1000)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(MAX_FETCH_MESSAGES)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server channel.', ephemeral: true });
    }

    const channel = interaction.channel;
    if (!channel || ![
      ChannelType.GuildText,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
      ChannelType.GuildAnnouncement,
    ].includes(channel.type)) {
      return interaction.reply({ content: 'This command can only run in a text channel or thread.', ephemeral: true });
    }

    try {
      await interaction.deferReply();
    } catch (e) {
      const code = e?.code || e?.status;
      const msg = (e?.message || '').toLowerCase();
      if (code === 40060 || code === 10062 || msg.includes('already been acknowledged') || msg.includes('unknown interaction')) {
        return;
      }
      throw e;
    }

    if (!OPENAI_API_KEY) {
      return interaction.editReply('OpenAI API key not configured. Set OPENAI_API_KEY in your environment.');
    }

    const requested = interaction.options.getInteger('count') ?? 150;
    const target = Math.min(MAX_FETCH_MESSAGES, Math.max(1, requested));

    let collected = [];
    let before;
    try {
      while (collected.length < target) {
        const limit = Math.min(100, target - collected.length);
        const batch = await channel.messages.fetch({ limit, ...(before ? { before } : {}) });
        if (!batch || batch.size === 0) break;
        const arr = [...batch.values()];
        collected.push(...arr);
        const oldest = arr.reduce((acc, m) => (!acc || m.createdTimestamp < acc.createdTimestamp ? m : acc), null);
        before = oldest?.id;
        if (!before) break;
      }
    } catch (err) {
      return interaction.editReply(`Could not fetch recent messages: ${err.message}`);
    }

    if (!collected.length) {
      return interaction.editReply('No recent messages found to analyze.');
    }

    const ordered = collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const lines = [];
    let totalChars = 0;
    let truncated = false;
    for (const m of ordered) {
      const name = m.member?.displayName || m.author?.username || 'Unknown';
      const author = m.author?.bot ? `${name} [bot]` : name;
      const content = sanitizeContent(m.content || '');
      const attachments = m.attachments?.size
        ? ` [attachments: ${[...m.attachments.values()].map((a) => a.name).filter(Boolean).join(', ')}]`
        : '';
      const line = content.trim()
        ? `${author}: ${content}${attachments}`
        : attachments
        ? `${author}:${attachments}`
        : '';
      if (!line) continue;
      if (totalChars + line.length + 1 > MAX_TRANSCRIPT_CHARS) {
        truncated = true;
        break;
      }
      lines.push(line);
      totalChars += line.length + 1;
    }

    if (!lines.length) {
      return interaction.editReply('Recent messages did not contain analyzable text.');
    }

    const transcript = lines.join('\n');
    const persona = getPersona(interaction.guildId) || DEFAULT_PERSONA;

    let tokenSpent = false;
    try {
      const consumed = await consumeJudgementToken(interaction.guildId, interaction.user.id);
      if (!consumed) {
        return interaction.editReply('You need a judgement token to run an analysis. Earn or request one before retrying.');
      }
      tokenSpent = true;

      const prompt = `Provide a structured analysis of the following Discord conversation. Highlight conflicts, agreements, risks, and recommended next steps. Reference speakers by their display names. Transcript (oldest to newest):\n\n${transcript}`;

      const response = await fetchApi('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_ANALYSIS_MODEL,
          messages: [
            { role: 'system', content: persona },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        let message = text;
        try {
          const parsed = JSON.parse(text);
          message = parsed?.error?.message || message;
        } catch (_) {}
        throw new Error(message || 'Failed to generate analysis.');
      }

      let out;
      try {
        out = JSON.parse(text)?.choices?.[0]?.message?.content?.trim();
      } catch (_) {
        throw new Error('Invalid response from analysis provider.');
      }
      if (!out) {
        throw new Error('No analysis returned.');
      }

      const sections = buildAnalysisSections(out);
      const descriptionParts = [`Analyzed ${lines.length} messages.`];
      if (truncated) {
        descriptionParts.push(`Transcript truncated to ${MAX_TRANSCRIPT_CHARS} characters.`);
      }
      const embeds = createFieldEmbeds({
        title: 'Conversation Analysis',
        sections: sections.length ? sections : [{ name: 'Analysis', value: out }],
        user: interaction.user,
        description: descriptionParts.join(' '),
      });

      if (!embeds.length) {
        return interaction.editReply(out);
      }

      return interaction.editReply({ embeds });
    } catch (err) {
      if (tokenSpent) {
        try {
          await refundJudgementToken(interaction.guildId, interaction.user.id);
        } catch (refundErr) {
          console.error('Failed to refund judgement token after analysis error', refundErr);
        }
      }
      return interaction.editReply(`Analysis failed: ${err.message}`);
    }
  },
};
