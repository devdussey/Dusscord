const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../utils/ownerIds');
const judgementStore = require('../utils/judgementStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('givejudgement')
    .setDescription('Grant judgement tokens to a user')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('User to receive judgement tokens')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Number of judgement tokens to grant')
        .setMinValue(1)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: 'Only bot owners can use this command.',
        ephemeral: true,
      });
    }

    const targetUser = interaction.options.getUser('user', true);
    const amountInput = interaction.options.getInteger('amount');
    const amount = Number.isFinite(amountInput) && amountInput > 0 ? amountInput : 1;

    const guildId = interaction.guildId ?? interaction.guild?.id;
    if (!guildId) {
      return interaction.reply({
        content: 'This command can only be used within a server.',
        ephemeral: true,
      });
    }

    const balance = await judgementStore.addTokens(guildId, targetUser.id, amount);

    await interaction.reply({
      content: `Granted ${amount} judgement token${amount === 1 ? '' : 's'} to ${targetUser}. They now have ${balance}.`,
      ephemeral: true,
    });
  },
};
