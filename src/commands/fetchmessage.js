const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const { isOwner } = require('../utils/ownerIds');
const messageLogStore = require('../utils/userMessageLogStore');

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

function clampLimit(value) {
  const num = Number.isFinite(value) ? value : DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(num), 10), MAX_LIMIT);
}

function formatCount(count, noun) {
  const abs = Math.abs(count);
  return `${count} ${noun}${abs === 1 ? '' : 's'}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fetchmessage')
    .setDescription('Owner-only: sync user messages from a channel into the analysis store')
    .addChannelOption((option) => option
      .setName('channel')
      .setDescription('Channel to fetch messages from')
      .addChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.AnnouncementThread,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
      )
      .setRequired(true))
    .addIntegerOption((option) => option
      .setName('limit')
      .setDescription(`Maximum number of messages to scan (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT})`)
      .setMinValue(10)
      .setMaxValue(MAX_LIMIT)
      .setRequired(false)),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
    }
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'This command is restricted to bot owners.', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel', true);
    const requestedLimit = interaction.options.getInteger('limit');
    const maxToScan = clampLimit(requestedLimit ?? DEFAULT_LIMIT);

    if (typeof channel?.isTextBased !== 'function' || !channel.isTextBased()) {
      return interaction.reply({
        content: 'Please choose a text-based channel that stores messages.',
        ephemeral: true,
      });
    }

    try { await interaction.deferReply({ ephemeral: true }); } catch (_) {}

    const me = channel.guild?.members?.me;
    const permissions = me ? channel.permissionsFor(me) : null;
    if (!permissions || !permissions.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.ReadMessageHistory)) {
      return interaction.editReply({
        content: 'I need the View Channel and Read Message History permissions in that channel to fetch messages.',
      });
    }

    if (typeof channel.join === 'function' && channel.isThread() && !channel.joined) {
      try {
        await channel.join();
      } catch (err) {
        return interaction.editReply({
          content: `Failed to join the thread before syncing: ${err?.message || 'unknown error'}`,
        });
      }
    }

    const perUser = new Map();
    let scanned = 0;
    let stored = 0;
    let skippedBots = 0;
    let before;

    try {
      while (scanned < maxToScan) {
        const remaining = maxToScan - scanned;
        const fetchLimit = Math.min(100, Math.max(1, remaining));
        const options = { limit: fetchLimit };
        if (before) options.before = before;

        const batch = await channel.messages.fetch(options);
        if (!batch?.size) break;

        const messages = [...batch.values()].sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0));
        scanned += messages.length;
        before = messages[0]?.id;

        for (const message of messages) {
          if (!message) continue;
          if (message.author?.bot) {
            skippedBots += 1;
            continue;
          }
          if (!message.author) continue;
          if (message.system) continue;

          const bucket = perUser.get(message.author.id) || [];
          bucket.push(message);
          perUser.set(message.author.id, bucket);
        }

        if (messages.length < fetchLimit) break;
      }
    } catch (err) {
      return interaction.editReply({
        content: `Failed to fetch messages: ${err?.message || 'unknown error'}`,
      });
    }

    for (const [userId, messages] of perUser.entries()) {
      const sorted = messages.sort((a, b) => (a.createdTimestamp || 0) - (b.createdTimestamp || 0));
      try {
        const result = await messageLogStore.recordMessagesBulk(interaction.guildId, userId, sorted);
        stored += result?.added || 0;
      } catch (err) {
        return interaction.editReply({
          content: `Failed to store messages for <@${userId}>: ${err?.message || 'unknown error'}`,
        });
      }
    }

    const uniqueUsers = perUser.size;
    const summaryLines = [];
    summaryLines.push(`Scanned ${formatCount(scanned, 'message')} from ${channel}.`);
    summaryLines.push(`Stored ${formatCount(stored, 'message')} across ${formatCount(uniqueUsers, 'user')} in the analysis log.`);
    if (skippedBots > 0) {
      summaryLines.push(`Skipped ${formatCount(skippedBots, 'bot/system message')}.`);
    }
    if (scanned >= maxToScan) {
      summaryLines.push(`Reached the configured scan limit of ${maxToScan}. Run again to fetch older history.`);
    }
    if (!stored) {
      summaryLines.push('No user messages were stored. They may have all been from bots or outside the scanned range.');
    }

    return interaction.editReply({ content: summaryLines.join('\n') });
  },
};
