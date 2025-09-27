const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const coinStore = require('../utils/coinStore');
const tokenStore = require('../utils/messageTokenStore');
const judgementStore = require('../utils/judgementStore');
const smiteConfigStore = require('../utils/smiteConfigStore');
const { getSmiteCost, getJudgementCost } = require('../utils/economyConfig');
const { resolveEmbedColour } = require('../utils/guildColourStore');

function formatCoins(value) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function buildStoreEmbed({
  guildId,
  user,
  coins,
  smiteBalance,
  smiteCost,
  judgementBalance,
  judgementCost,
  smiteEnabled,
}) {
  const embed = new EmbedBuilder()
    .setColor(resolveEmbedColour(guildId, 0x9b59b6))
    .setTitle('Divine Storefront')
    .setDescription('Spend your celestial coins on powerful blessings and punishments.')
    .addFields(
      {
        name: '🪙 Your Balance',
        value: `${formatCoins(coins)} coins available to spend.`,
      },
      {
        name: '⚡ Smite Tomes',
        value: `Price: ${formatCoins(smiteCost)} coins each\nCall down heavenly lightning to smite misbehaving mortals with the /smite command.${
          smiteEnabled
            ? '\nSmite rewards are currently **enabled** on this server.'
            : '\nSmite rewards are currently **disabled** on this server.'
        }\nOwned: ${smiteBalance}`,
      },
      {
        name: '⚖️ Judgement Seals',
        value: `Price: ${formatCoins(judgementCost)} coins each\nUnlock profound insights with /analysis or share wisdom with /givejudgement.\nOwned: ${judgementBalance}`,
      }
    )
    .setFooter({ text: 'Select an item below to purchase it with your coins.' });

  const avatarUrl = typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ forceStatic: true }) : null;
  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  return embed;
}

function createMenu({ disabled = false, coins, smiteCost, judgementCost }) {
  const options = [
    {
      label: 'Buy a Smite Tome',
      description: `Costs ${formatCoins(smiteCost)} coins` + (coins < smiteCost ? ' (insufficient coins)' : ''),
      value: 'buy_smite',
      emoji: '⚡',
    },
    {
      label: 'Buy a Judgement Seal',
      description: `Costs ${formatCoins(judgementCost)} coins` + (coins < judgementCost ? ' (insufficient coins)' : ''),
      value: 'buy_judgement',
      emoji: '⚖️',
    },
  ];

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('store-select')
      .setPlaceholder('Choose an item to purchase')
      .setMinValues(1)
      .setMaxValues(1)
      .setDisabled(disabled)
      .addOptions(options)
  );
}

async function handlePurchase({
  selection,
  choice,
  guildId,
  userId,
  coins,
  smiteCost,
  judgementCost,
}) {
  if (choice === 'buy_smite') {
    if (coins + 1e-6 < smiteCost) {
      await selection.reply({ content: 'You do not have enough coins to buy a Smite Tome.', ephemeral: true });
      return null;
    }
    const spent = await coinStore.spendCoins(guildId, userId, smiteCost);
    if (!spent) {
      await selection.reply({ content: 'Purchase failed because your coin balance changed. Try again.', ephemeral: true });
      return null;
    }
    await tokenStore.addTokens(guildId, userId, 1);
    return '⚡ You have purchased a Smite Tome!';
  }

  if (choice === 'buy_judgement') {
    if (coins + 1e-6 < judgementCost) {
      await selection.reply({ content: 'You do not have enough coins to buy a Judgement Seal.', ephemeral: true });
      return null;
    }
    const spent = await coinStore.spendCoins(guildId, userId, judgementCost);
    if (!spent) {
      await selection.reply({ content: 'Purchase failed because your coin balance changed. Try again.', ephemeral: true });
      return null;
    }
    await judgementStore.addTokens(guildId, userId, 1);
    return '⚖️ You have purchased a Judgement Seal!';
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder().setName('store').setDescription('Browse and purchase Judgements or Smites'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command within a server to visit the store.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    let coins = coinStore.getBalance(guildId, userId);
    const smiteBalance = tokenStore.getBalance(guildId, userId);
    const judgementBalance = judgementStore.getBalance(guildId, userId);
    const smiteCost = getSmiteCost();
    const judgementCost = getJudgementCost();
    const smiteEnabled = smiteConfigStore.isEnabled(guildId);

    let message = await interaction.editReply({
      embeds: [
        buildStoreEmbed({
          guildId,
          user: interaction.user,
          coins,
          smiteBalance,
          smiteCost,
          judgementBalance,
          judgementCost,
          smiteEnabled,
        }),
      ],
      components: [createMenu({ coins, smiteCost, judgementCost })],
    });

    if (typeof message.awaitMessageComponent !== 'function') {
      await interaction.editReply({
        components: [createMenu({ disabled: true, coins, smiteCost, judgementCost })],
      });
      return;
    }

    const filter = (componentInteraction) =>
      componentInteraction.user.id === userId && componentInteraction.customId === 'store-select';

    let active = true;
    while (active) {
      try {
        const selection = await message.awaitMessageComponent({
          componentType: ComponentType.StringSelect,
          filter,
          time: 60000,
        });

        const choice = selection.values[0];
        const purchaseMessage = await handlePurchase({
          selection,
          choice,
          guildId,
          userId,
          coins,
          smiteCost,
          judgementCost,
        });

        if (purchaseMessage) {
          coins = coinStore.getBalance(guildId, userId);
          const updatedSmiteBalance = tokenStore.getBalance(guildId, userId);
          const updatedJudgementBalance = judgementStore.getBalance(guildId, userId);

          message = await selection.update({
            embeds: [
              buildStoreEmbed({
                guildId,
                user: interaction.user,
                coins,
                smiteBalance: updatedSmiteBalance,
                smiteCost,
                judgementBalance: updatedJudgementBalance,
                judgementCost,
                smiteEnabled,
              }),
            ],
            components: [createMenu({ coins, smiteCost, judgementCost })],
            content: purchaseMessage,
          });
        }
      } catch (error) {
        active = false;
      }
    }

    await interaction.editReply({
      components: [createMenu({ disabled: true, coins, smiteCost, judgementCost })],
    });
  },
};
