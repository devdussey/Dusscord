const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const triviaData = require('../utils/triviaData');
const { resolveEmbedColour } = require('../utils/guildColourStore');

function formatCategoryLine(category) {
  const description = category.description
    ? category.description.slice(0, 180) + (category.description.length > 180 ? '…' : '')
    : 'No description provided.';
  const difficultyText = category.difficulties.length
    ? category.difficulties
      .map(entry => `${triviaData.formatDifficultyName(entry.key)} (${entry.questions})`)
      .join(', ')
    : 'No questions yet';

  return `**${category.name}** (\`${category.id}\`)
${description}
Difficulties: ${difficultyText}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('triviacategories')
    .setDescription('Show the list of available trivia categories and difficulties')
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
    }

    const categories = triviaData.listCategories();
    if (!categories.length) {
      return interaction.reply({ content: 'No trivia categories are available yet.', ephemeral: true });
    }

    const lines = categories.map(formatCategoryLine);
    const embedColor = resolveEmbedColour(interaction.guildId, 0x5865F2);
    const embeds = [];
    let buffer = '';

    for (const line of lines) {
      const next = buffer ? `${buffer}\n\n${line}` : line;
      if (next.length > 3800 && buffer) {
        embeds.push(new EmbedBuilder()
          .setColor(embedColor)
          .setTitle('Trivia Categories')
          .setDescription(buffer)
          .setFooter({ text: 'Use /triviastart to begin a game in your favourite category.' }));
        buffer = line;
      } else {
        buffer = next;
      }
    }

    if (buffer) {
      embeds.push(new EmbedBuilder()
        .setColor(embedColor)
        .setTitle('Trivia Categories')
        .setDescription(buffer)
        .setFooter({ text: 'Use /triviastart to begin a game in your favourite category.' }));
    }

    return interaction.reply({ embeds });
  },
};
