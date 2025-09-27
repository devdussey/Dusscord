const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
// node-fetch v3 is ESM-only; use dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function deriveAvatarUrl(userId, entry) {
  if (!entry) return null;
  if (entry.url) return entry.url;
  const hash = entry.avatar || entry.hash || entry.id;
  if (!hash || typeof hash !== 'string') return null;
  const ext = hash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.${ext}?size=4096`;
}

function formatTimestamp(entry) {
  const ts = entry?.timestamp || entry?.time || entry?.created_at || entry?.updated_at;
  if (!ts) return null;
  const ms = typeof ts === 'number' ? ts : Date.parse(ts);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatarhistory')
    .setDescription("Display a user's last 6 avatars")
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('User to inspect (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    await interaction.deferReply();

    try {
      const endpoint = `https://discordlookup.mesalytic.moe/v1/avatarhistory/${target.id}`;
      const response = await fetch(endpoint, {
        headers: { 'User-Agent': 'DusscordBot/1.0 (+https://github.com/)' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const history = Array.isArray(data?.history)
        ? data.history
        : Array.isArray(data?.avatars)
          ? data.avatars
          : [];

      const limited = history.slice(0, 6);
      const lines = [];
      for (let i = 0; i < limited.length; i++) {
        const entry = limited[i];
        const url = deriveAvatarUrl(target.id, entry);
        if (!url) continue;
        const timestamp = formatTimestamp(entry);
        const timeText = timestamp ? ` — <t:${timestamp}:R>` : '';
        lines.push(`**${i + 1}.** [View Avatar](${url})${timeText}`);
      }

      if (lines.length === 0) {
        await interaction.editReply({
          content: "I couldn't find any avatar history for that user.",
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`${target.tag || target.username}'s recent avatars`)
        .setDescription(lines.join('\n'))
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setColor(0x5865F2);

      await interaction.editReply({
        content: null,
        embeds: [embed],
      });
    } catch (error) {
      console.error('Failed to load avatar history:', error);
      await interaction.editReply({
        content: 'Sorry, I was unable to fetch that avatar history right now.',
      });
    }
  },
};

