const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const triviaData = require('../utils/triviaData');
const triviaGameManager = require('../utils/triviaGameManager');

const categoriesForChoices = (() => {
  const categories = triviaData.listCategories();
  if (!categories.length || categories.length > 25) return [];
  return categories.map(category => ({ name: category.name.slice(0, 100), value: category.id }));
})();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('triviastart')
    .setDescription('Start a trivia game in the current channel')
    .setDMPermission(false)
    .addStringOption(option => {
      option
        .setName('category')
        .setDescription('Category of questions to use')
        .setRequired(true);
      if (categoriesForChoices.length) {
        option.addChoices(...categoriesForChoices);
      }
      return option;
    })
    .addStringOption(option =>
      option
        .setName('difficulty')
        .setDescription('Question difficulty')
        .setRequired(true)
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' },
        ),
    )
    .addIntegerOption(option =>
      option
        .setName('questions')
        .setDescription('How many questions to ask (default 10)')
        .setMinValue(1)
        .setMaxValue(25),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server channel.', ephemeral: true });
    }

    const channel = interaction.channel;
    if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased()) {
      return interaction.reply({ content: 'Trivia can only run in text-based channels.', ephemeral: true });
    }

    const mePermissions = channel.permissionsFor(interaction.client.user);
    if (!mePermissions?.has(PermissionsBitField.Flags.SendMessages)) {
      return interaction.reply({ content: 'I need permission to send messages in this channel to start trivia.', ephemeral: true });
    }
    if (!mePermissions?.has(PermissionsBitField.Flags.EmbedLinks)) {
      return interaction.reply({ content: 'I need the Embed Links permission in this channel to host trivia.', ephemeral: true });
    }

    const rawCategoryId = interaction.options.getString('category', true);
    const difficultyInput = interaction.options.getString('difficulty', true);
    const requestedQuestions = interaction.options.getInteger('questions');

    const normalisedDifficulty = triviaData.normaliseDifficultyKey(difficultyInput);
    if (!normalisedDifficulty) {
      return interaction.reply({ content: 'Please choose a valid difficulty (easy, medium, or hard).', ephemeral: true });
    }

    let category = triviaData.getCategory(rawCategoryId);
    if (!category) {
      const match = triviaData.listCategories().find(cat => cat.id.toLowerCase() === rawCategoryId.toLowerCase());
      if (match) category = triviaData.getCategory(match.id);
    }
    if (!category) {
      return interaction.reply({ content: 'That category could not be found. Use /triviacategories for a list.', ephemeral: true });
    }

    const pool = category.difficulties[normalisedDifficulty];
    if (!pool || !pool.length) {
      return interaction.reply({ content: 'There are no questions uploaded for that difficulty yet.', ephemeral: true });
    }

    const desiredCount = requestedQuestions ?? undefined;

    const result = await triviaGameManager.startTriviaGame(interaction, {
      categoryId: category.id,
      difficulty: normalisedDifficulty,
      questionCount: desiredCount,
    });

    if (!result.ok) {
      return interaction.reply({ content: result.error || 'Unable to start trivia right now.', ephemeral: true });
    }

    const acknowledgement = `Starting **${category.name}** trivia (${triviaData.formatDifficultyName(normalisedDifficulty)}) with ${result.questionCount} question${result.questionCount === 1 ? '' : 's'} in ${channel}. Good luck!`;

    return interaction.reply({ content: acknowledgement, ephemeral: true });
  },
};
