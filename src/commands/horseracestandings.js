const { SlashCommandBuilder, EmbedBuilder, escapeMarkdown } = require('discord.js');
const { getLeaderboard, getStatsForGuild } = require('../utils/horseRaceStore');
const { resolveEmbedColour } = require('../utils/guildColourStore');

const PLACE_EMOJIS = ['🥇', '🥈', '🥉'];

function formatName(raw, emphasize = false) {
  const safe = escapeMarkdown(String(raw || 'Unknown')).slice(0, 64);
  return emphasize ? `**${safe}**` : safe;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('horseracestandings')
    .setDescription('View horse race podium standings for this server.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Show stats for a specific rider (defaults to you).')
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Horse race standings are only available inside a server.', ephemeral: true });
      return;
    }

    const guildId = interaction.guildId;
    const leaderboard = getLeaderboard(guildId);

    if (!leaderboard.length) {
      await interaction.reply({ content: 'No horse races have been recorded here yet — run /horserace to start one!', ephemeral: true });
      return;
    }

    const focusUser = interaction.options.getUser('user') || interaction.user;
    const topEntries = leaderboard.slice(0, 10);

    const idsToFetch = new Set(topEntries.map(entry => entry.userId));
    idsToFetch.add(focusUser.id);

    let fetchedMembers = new Map();
    try {
      const members = await interaction.guild.members.fetch({ user: Array.from(idsToFetch) });
      fetchedMembers = new Map(members.map(member => [member.id, member]));
    } catch (err) {
      console.warn('Failed to fetch member list for horserace standings:', err?.message || err);
    }

    const resolveDisplayName = (userId) => {
      const member = fetchedMembers.get(userId);
      if (member?.displayName) return member.displayName;
      const cachedUser = interaction.client.users.cache.get(userId);
      if (cachedUser?.username) return cachedUser.username;
      return `User ${userId}`;
    };

    const lines = topEntries.map((entry, index) => {
      const place = index + 1;
      const medal = PLACE_EMOJIS[place - 1] ?? `#${place}`;
      const isFocus = entry.userId === focusUser.id;
      const name = formatName(resolveDisplayName(entry.userId), isFocus);
      return `${medal} ${name} — 🥇 ${entry.first} | 🥈 ${entry.second} | 🥉 ${entry.third} (Races: ${entry.races})`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏇 Horse Race Standings')
      .setColor(resolveEmbedColour(interaction.guildId, 0x5865f2))
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Standings are sorted by golds, then silvers, bronzes, and races.' });

    const guildStats = getStatsForGuild(guildId);
    const focusStats = guildStats[focusUser.id];
    if (focusStats) {
      const rankIndex = leaderboard.findIndex(entry => entry.userId === focusUser.id);
      const rankLabel = rankIndex === -1 ? 'Unranked' : `#${rankIndex + 1}`;
      embed.addFields({
        name: `Stats for ${formatName(resolveDisplayName(focusUser.id), true)} (${rankLabel})`,
        value: `🥇 ${focusStats.first || 0}\n🥈 ${focusStats.second || 0}\n🥉 ${focusStats.third || 0}\nTotal races: ${focusStats.races || 0}`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};
