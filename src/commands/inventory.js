const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const coinStore = require('../utils/coinStore');
const tokenStore = require('../utils/messageTokenStore');
const judgementStore = require('../utils/judgementStore');
const smiteConfigStore = require('../utils/smiteConfigStore');
const { resolveEmbedColour } = require('../utils/guildColourStore');
const {
  getSmiteCost,
  getJudgementCost,
  getPrayReward,
} = require('../utils/economyConfig');

function formatCoins(value) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  if (seconds > 0 && parts.length < 2) parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  return parts.length ? parts.join(', ') : '0 seconds';
}

function buildInventoryEmbed({
  guildId,
  user,
  coinSummary,
  smiteBalance,
  smiteCost,
  judgementBalance,
  judgementCost,
  smiteEnabled,
  prayStatus,
  prayReward,
}) {
  const username = user && typeof user.username === 'string' && user.username.trim().length
    ? user.username
    : null;
  const title = username ? `${username}'s Divine Inventory` : 'Your Divine Inventory';

  const embed = new EmbedBuilder()
    .setColor(resolveEmbedColour(guildId, 0xf1c40f))
    .setTitle(title)
    .setDescription(
      'Your sacred belongings, tallied and catalogued. Spend coins in /store to expand your arsenal.'
    )
    .addFields(
      {
        name: '🪙 Coins',
        value: `**Balance:** ${formatCoins(coinSummary.coins)}\n**Ledger:** Earned ${formatCoins(
          coinSummary.lifetimeEarned
        )} · Spent ${formatCoins(
          coinSummary.lifetimeSpent
        )}\nCoins are the divine currency for all purchases, including empowering Smites and unlocking Judgements.`,
      },
      {
        name: '⚡ Smites',
        value: `**Owned:** ${smiteBalance}\n**Cost:** ${formatCoins(
          smiteCost
        )} coins each\nCall down righteous lightning to discipline wrongdoers using the /smite command. ${
          smiteEnabled
            ? 'Smite rewards are currently **enabled** on this server.'
            : 'Smite rewards are currently **disabled** on this server.'
        }`,
      },
      {
        name: '⚖️ Judgements',
        value: `**Owned:** ${judgementBalance}\n**Cost:** ${formatCoins(
          judgementCost
        )} coins each\nJudgements unlock the powerful /analysis command and can also be bestowed by moderators using /givejudgement.`,
      }
    );

  embed.addFields({
    name: '🙏 Daily Prayer',
    value: prayStatus.canPray
      ? `Ready to pray! Use /pray to receive ${formatCoins(prayReward)} coins.`
      : `Already blessed. You can pray again in ${formatDuration(prayStatus.cooldownMs)}.`,
  });

  const avatarUrl = typeof user.displayAvatarURL === 'function' ? user.displayAvatarURL({ forceStatic: true }) : null;
  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  embed.setFooter({ text: 'Visit the Divine Store to trade your blessings for power.' });

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Check your coin balance, Smites, and Judgements'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server to view your items.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const coinSummary = coinStore.getSummary(guildId, userId);
    const smiteBalance = tokenStore.getBalance(guildId, userId);
    const smiteCost = getSmiteCost();
    const judgementBalance = judgementStore.getBalance(guildId, userId);
    const judgementCost = getJudgementCost();
    const smiteEnabled = smiteConfigStore.isEnabled(guildId);
    const prayStatus = coinStore.getPrayStatus(guildId, userId);
    const prayReward = getPrayReward();

    const embed = buildInventoryEmbed({
      guildId,
      user: interaction.user,
      coinSummary,
      smiteBalance,
      smiteCost,
      judgementBalance,
      judgementCost,
      smiteEnabled,
      prayStatus,
      prayReward,
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
