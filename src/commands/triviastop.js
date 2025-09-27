const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const triviaGameManager = require('../utils/triviaGameManager');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('triviastop')
    .setDescription('Stop the active trivia game in this channel')
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server channel.', ephemeral: true });
    }

    const game = triviaGameManager.getActiveGame(interaction.guildId, interaction.channelId);
    if (!game) {
      return interaction.reply({ content: 'There is no active trivia game in this channel.', ephemeral: true });
    }

    const canStop = interaction.user.id === game.hostId
      || interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)
      || interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)
      || interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers);

    if (!canStop) {
      return interaction.reply({ content: 'Only the host or a server moderator can stop this trivia game.', ephemeral: true });
    }

    const stopped = triviaGameManager.stopTriviaGame(interaction.guildId, interaction.channelId, 'cancelled-by-user');
    if (!stopped) {
      return interaction.reply({ content: 'The trivia game could not be stopped.', ephemeral: true });
    }

    return interaction.reply({ content: 'The trivia game will wrap up after the current question.', ephemeral: true });
  },
};
