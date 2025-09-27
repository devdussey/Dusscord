const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown } = require('discord.js');
const triviaStatsStore = require('../utils/triviaStatsStore');

async function resolveDisplayName(guild, userId) {
  if (!guild) return `User ${userId}`;
  try {
    const member = await guild.members.fetch(userId);
    const display = member.displayName || member.user.globalName || member.user.username;
    return display ? escapeMarkdown(display) : `User ${userId}`;
  } catch (err) {
    try {
      const user = await guild.client.users.fetch(userId);
      const name = user.globalName || user.username;
      return name ? escapeMarkdown(name) : `User ${userId}`;
    } catch (_) {
      return `User ${userId}`;
    }
  }
}

function formatLeaderboardLine(entry, index) {
  const parts = [];
  if (entry.firstPlace) parts.push(`${entry.firstPlace} win${entry.firstPlace === 1 ? '' : 's'}`);
  if (entry.secondPlace) parts.push(`${entry.secondPlace} runner-up${entry.secondPlace === 1 ? '' : 's'}`);
  if (entry.thirdPlace) parts.push(`${entry.thirdPlace} third-place`);
  if (entry.correctAnswers) parts.push(`${entry.correctAnswers} correct`);
  if (entry.gamesPlayed) parts.push(`${entry.gamesPlayed} game${entry.gamesPlayed === 1 ? '' : 's'}`);

  const accuracy = entry.roundsParticipated > 0
    ? Math.round((entry.correctAnswers / entry.roundsParticipated) * 100)
    : null;
  const accuracyText = accuracy !== null ? `${accuracy}% accuracy` : 'No rounds recorded';
  const coinsText = entry.coinsEarned > 0 ? `${entry.coinsEarned} coins earned` : null;

  const details = parts.length ? parts.join(', ') : 'No stats recorded yet';
  const meta = coinsText ? `${accuracyText} • ${coinsText}` : accuracyText;

  return `${index + 1}. **${entry.name}** — ${details} (${meta})`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('triviarankings')
    .setDescription('View the historical trivia leaderboard for this server')
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server channel.', ephemeral: true });
    }

    await interaction.deferReply();

    const leaderboard = triviaStatsStore.getLeaderboard(interaction.guildId);
    if (!leaderboard.length) {
      return interaction.editReply({ content: 'No trivia games have been recorded yet. Start one with /triviastart!' });
    }

    const topEntries = leaderboard.slice(0, 10);
    const resolved = await Promise.all(topEntries.map(async (entry, index) => ({
      ...entry,
      name: await resolveDisplayName(interaction.guild, entry.userId),
      index,
    })));

    const lines = resolved.map(entry => formatLeaderboardLine(entry, entry.index));

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Trivia Leaderboard')
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Wins grant +20 coins and runners-up earn +10 coins.' });

    return interaction.editReply({ embeds: [embed] });
  },
};
