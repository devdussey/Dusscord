const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const judgementStore = require('../utils/judgementStore');
const messageLogStore = require('../utils/userMessageLogStore');

const fetch = (...args) => import('node-fetch').then(({ default: fetchImpl }) => fetchImpl(...args));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
const OPENAI_CHAT_MODEL = process.env.ANALYSIS_MODEL || process.env.CHAT_MODEL || 'gpt-4o-mini';

const DEFAULT_PERSONA = (process.env.ANALYSIS_PERSONA_PROMPT || '').trim() || [
  'You are a private analytical assistant configured by the bot owner to review community members.',
  'Analyse the supplied Discord messages for tone, behaviour patterns, rule compliance, and wellbeing concerns.',
  'Respond in JSON with keys "summary", "strengths", "risks", and "recommendations". Each value must be a short markdown string (<800 characters).',
  'Do not include any other keys or explanatory text.',
].join(' ');

function formatMessages(logs, targetCount) {
  if (!Array.isArray(logs) || !logs.length) {
    return { text: 'No recent messages.', usedCount: 0 };
  }
  const lines = [];
  let consumed = 0;
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    if (lines.length >= targetCount) break;
    const entry = logs[i];
    const ts = Number.isFinite(entry?.createdTimestamp)
      ? new Date(entry.createdTimestamp).toISOString()
      : 'unknown time';
    const baseContent = entry?.content ? entry.content : '(no content)';
    const snippet = baseContent.length > 350 ? `${baseContent.slice(0, 347)}...` : baseContent;
    consumed += snippet.length;
    if (consumed > 150_000) break;
    lines.push(`- [${ts}] ${snippet}`);
  }
  if (!lines.length) {
    return { text: 'No recent messages.', usedCount: 0 };
  }
  const ordered = lines.reverse();
  return { text: ordered.join('\n'), usedCount: ordered.length };
}

function buildEmbed(interaction, analysis, count) {
  const embed = new EmbedBuilder()
    .setTitle('User Analysis')
    .setColor(0x5865f2)
    .setDescription(`Review of ${interaction.user.tag} (${interaction.user.id})\nMessages analysed: ${count}`)
    .setTimestamp(new Date());

  const fields = [];
  if (analysis && typeof analysis === 'object') {
    const entries = [
      ['Summary', analysis.summary],
      ['Strengths', analysis.strengths],
      ['Risks', analysis.risks],
      ['Recommendations', analysis.recommendations],
    ];
    for (const [name, value] of entries) {
      if (!value) continue;
      const safe = String(value).slice(0, 1024) || 'No data provided.';
      fields.push({ name, value: safe, inline: false });
    }
  }

  if (!fields.length) {
    const fallback = typeof analysis === 'string' ? analysis : 'No analysis generated.';
    fields.push({ name: 'Report', value: fallback.slice(0, 1024) || 'No analysis generated.', inline: false });
  }

  embed.addFields(fields);
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analysis')
    .setDescription('Spend a Judgement to analyse your last 1000 messages'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
    }

    try { await interaction.deferReply({ ephemeral: true }); } catch (_) {}

    if (!OPENAI_API_KEY) {
      return interaction.editReply({ content: 'OpenAI API key not configured. Set OPENAI_API_KEY to enable /analysis.' });
    }

    const balance = judgementStore.getBalance(interaction.guildId, interaction.user.id);
    if (balance <= 0) {
      const progress = judgementStore.getProgress(interaction.guildId, interaction.user.id);
      const remaining = progress.messagesUntilNext || judgementStore.AWARD_THRESHOLD;
      return interaction.editReply({
        content: `You do not have any Judgements. Send ${remaining} more message${remaining === 1 ? '' : 's'} to earn one, or ask an owner to use /givejudgement.`,
      });
    }

    const logs = messageLogStore.getRecentMessages(interaction.guildId, interaction.user.id, 1000);
    if (!logs.length) {
      return interaction.editReply({ content: 'No message history recorded yet. Try again after chatting more.' });
    }

    const consumed = await judgementStore.consumeToken(interaction.guildId, interaction.user.id);
    if (!consumed) {
      return interaction.editReply({ content: 'You no longer have a Judgement to spend.' });
    }

    const { text: formatted, usedCount } = formatMessages(logs, 1000);
    if (usedCount === 0) {
      await judgementStore.addTokens(interaction.guildId, interaction.user.id, 1);
      return interaction.editReply({ content: 'Unable to find analysable messages yet. Try again later.' });
    }

    const prompt = [
      `Analyse the following ${usedCount} messages written by ${interaction.user.tag}.`,
      'Identify behavioural patterns, moderation concerns, sentiment, and notable habits.',
      'Focus strictly on the content and avoid speculation beyond the evidence provided.',
      'Return JSON only.',
      '',
      formatted,
    ].join('\n');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_CHAT_MODEL,
          messages: [
            { role: 'system', content: DEFAULT_PERSONA },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        let msg = text;
        try { msg = JSON.parse(text)?.error?.message || msg; } catch (_) {}
        throw new Error(msg);
      }

      let analysis;
      try {
        const data = JSON.parse(text);
        const out = data?.choices?.[0]?.message?.content?.trim();
        if (!out) throw new Error('No analysis returned.');
        try {
          analysis = JSON.parse(out);
        } catch (_) {
          analysis = out;
        }
      } catch (err) {
        throw err;
      }

      const embed = buildEmbed(interaction, analysis, usedCount);
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await judgementStore.addTokens(interaction.guildId, interaction.user.id, 1);
      const msg = err?.message || String(err);
      await interaction.editReply({ content: `Analysis failed: ${msg}` });
    }
  },
};
