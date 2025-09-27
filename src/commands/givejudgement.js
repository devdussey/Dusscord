const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../utils/ownerIds');
const judgementStore = require('../utils/judgementStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('givejudgement')
    .setDescription('Owner: grant Judgements to a user')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('Member to receive Judgements')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt
        .setName('amount')
        .setDescription('How many Judgements to grant (default 1)')
        .setMinValue(1)
    )
    .addStringOption(opt =>
      opt
        .setName('reason')
        .setDescription('Optional note for the recipient (max 200 characters)')
        .setMaxLength(200)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
    }

    const target = interaction.options.getUser('user', true);
    const amountInput = interaction.options.getInteger('amount');
    const amount = Number.isFinite(amountInput) ? amountInput : 1;
    const reason = (interaction.options.getString('reason') || '').trim();

    const total = await judgementStore.addTokens(interaction.guildId, target.id, amount);

    const base = `Granted ${amount} Judgement${amount === 1 ? '' : 's'} to ${target.tag}.`;
    const balanceLine = `They now have ${total} Judgement${total === 1 ? '' : 's'}.`;
    const reasonLine = reason ? `Reason: ${reason}` : '';

    return interaction.reply({
      content: [base, balanceLine, reasonLine].filter(Boolean).join('\n').slice(0, 1900),
      ephemeral: true,
    });
  },
};
