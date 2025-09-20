const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const { isOwner } = require('../utils/ownerIds');

const categories = {
  Moderation: [
    { cmd: '/mute', desc: 'Timeout a member for a set duration (reason required)', perm: 'Moderate Members' },
    { cmd: '/kick', desc: 'Kick a member (reason required)', perm: 'Kick Members' },
    { cmd: '/ban', desc: 'Ban a user; optional prune_days (0–7)', perm: 'Ban Members' },
    { cmd: '/blacklist add/remove/list', desc: 'Manage the blacklist to auto-ban users on join', perm: 'Ban Members' },
    { cmd: '/purge', desc: 'Delete 1–100 recent messages in this channel', perm: 'Manage Messages' },
    { cmd: '/jail config/add/remove/status', desc: 'Jail members, remove roles, and restore them later', perm: 'Manage Roles' },
    { cmd: '/drugscordbag', desc: 'Spend a Smite to timeout a user for up to 10 minutes', perm: null },
  ],
  'Roles & Verification': [
    { cmd: '/autoroles add/remove/list/clear', desc: 'Auto-assign roles to new members', perm: 'Manage Roles' },
    { cmd: '/role add/remove', desc: 'Add or remove a specific role from a member', perm: 'Manage Roles' },
    { cmd: '/createrole', desc: 'Create a role with colour/hoist/mentionable options', perm: 'Manage Roles' },
    { cmd: '/deleterole', desc: 'Delete a role from the server', perm: 'Manage Roles' },
    { cmd: '/reactionrole create', desc: 'Post an embed with a selectable role menu', perm: 'Manage Roles' },
    { cmd: '/verify setup/status/disable/repost', desc: 'Verification button + role assignment with account-age checks', perm: 'Manage Server' },
  ],
  'Server Setup & Messaging': [
    { cmd: '/welcome setup/status/disable/test', desc: 'Configure a welcome embed for new members', perm: 'Manage Server' },
    { cmd: '/leave setup/status/disable/test', desc: 'Configure a leave embed for departing members', perm: 'Manage Server' },
    { cmd: '/confessconfig', desc: 'Send the anonymous confession button to a channel', perm: 'Manage Server' },
    { cmd: '/autorespond toggle/add/remove/list', desc: 'Keyword autoresponses with optional channel filters', perm: 'Administrator' },
    { cmd: '/repeat start/stop/list', desc: 'Schedule repeating messages every N seconds (>=60)', perm: 'Administrator' },
    { cmd: '/say', desc: 'Send a custom message as the bot (optional target channel)', perm: 'Administrator' },
  ],
  'Embeds & Styling': [
    { cmd: '/embed create/quick', desc: 'Interactive modal or quick embed sender', perm: null },
    { cmd: '/getembed', desc: 'Extract embed JSON from a message', perm: null },
    { cmd: '/colour set/get/reset', desc: 'Manage the default embed colour for this server', perm: 'Manage Server' },
  ],
  'Channels & Logs': [
    { cmd: '/createchannel', desc: 'Create text/voice/stage channels with optional category', perm: 'Manage Channels' },
    { cmd: '/channelsync', desc: 'Sync child channels with their category permissions', perm: 'Manage Channels' },
    { cmd: '/logchannels add/remove/list', desc: 'Monitor channels for admin deletions (DM owners)', perm: 'Manage Channels' },
    { cmd: '/logconfig', desc: 'Show status of security/mod/stream log settings', perm: 'Manage Server' },
    { cmd: '/logstream setchannel/toggle/show', desc: 'Stream real-time event logs to a channel', perm: 'Manage Server' },
    { cmd: '/modlog set/mode/toggle/show', desc: 'Configure moderation action logging outputs', perm: 'Manage Server' },
    { cmd: '/securitylog set/mode/clear/toggle/show', desc: 'Configure security log delivery and enablement', perm: 'Manage Server' },
    { cmd: '/securityreport', desc: 'Report members triggering permission/hierarchy issues', perm: 'Manage Server' },
    { cmd: '/antinuke config', desc: 'Configure anti-nuke protections and review status', perm: 'Manage Server' },
  ],
  'Emoji & Stickers': [
    { cmd: '/clone emoji/sticker', desc: 'Clone emojis or stickers via mention, ID, URL, or upload', perm: 'Manage Emojis and Stickers' },
    { cmd: '/cloneall', desc: 'Bulk clone emojis from another server with filters', perm: 'Manage Emojis and Stickers' },
    { cmd: '/enlarge emoji/sticker', desc: 'Post a large emoji or sticker image (supports Unicode)', perm: null },
  ],
  'AI & Media Tools': [
    { cmd: '/chat', desc: 'Chat with GPT with selectable personas and context size', perm: null },
    { cmd: '/summarize', desc: 'Summarize recent channel messages into bullets and a paragraph', perm: null },
    { cmd: '/transcribe', desc: 'Transcribe an attached audio file using Whisper', perm: null },
    { cmd: '/removebg', desc: 'Remove an image background via remove.bg', perm: null },
    { cmd: '/voiceauto enable/disable/status', desc: 'Auto-transcribe voice messages into configured channels', perm: 'Manage Server' },
  ],
  'Info & Utilities': [
    { cmd: '/joins leaderboard/user/setlog/backfill', desc: 'Join/leave stats; setup/backfill require Manage Server', perm: null },
    { cmd: '/botinfo', desc: 'Show bot instance, mode, commands loaded, and uptime', perm: null },
    { cmd: '/webhooks', desc: 'List server webhooks and their creators', perm: 'Manage Webhooks' },
    { cmd: '/servertag set/show/clear', desc: 'Manage the saved server tag for quick reference', perm: 'Manage Server' },
  ],
  'Owner Only': [
    { cmd: '/adminlist', desc: 'List mutual guilds where a user has Administrator', perm: 'Bot Owner' },
    { cmd: '/botlook', desc: 'Update the bot avatar, nickname, or bio', perm: 'Bot Owner' },
    { cmd: '/dmdiag test/role', desc: 'DM diagnostics for a member or role', perm: 'Bot Owner' },
    { cmd: '/wraith start/stop', desc: 'Create a private spam channel and isolate a member', perm: 'Bot Owner' },
  ],
};

function buildEmbed(categoryName, includeOwner, guildId) {
  const embed = new EmbedBuilder().setTitle('Bot Help');
  try {
    const { applyDefaultColour } = require('../utils/guildColourStore');
    applyDefaultColour(embed, guildId);
  } catch (_) {}

  if (categoryName && categories[categoryName]) {
    if (categoryName === 'Owner Only' && !includeOwner) {
      embed.setDescription('Owner-only commands are hidden.');
      return embed;
    }
    embed.setDescription(categoryName);
    const fields = categories[categoryName].map(({ cmd, desc, perm }) => ({
      name: cmd,
      value: `${desc}${perm ? `\nRequires: ${perm}` : ''}`,
      inline: false,
    }));
    embed.addFields(fields);
    return embed;
  }

  embed.setDescription('Select a category from the menu below.');
  const cats = Object.keys(categories).filter(
    (cat) => !(cat === 'Owner Only' && !includeOwner)
  );
  const value = cats.map((c) => `• ${c}`).join('\n');
  embed.addFields({ name: 'Categories', value });
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with the bot'),

  async execute(interaction) {
    const owner = isOwner(interaction.user.id);
    const embed = buildEmbed(null, owner, interaction.guildId);

    const options = Object.keys(categories)
      .filter((c) => !(c === 'Owner Only' && !owner))
      .map((c) => ({ label: c, value: c }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help-category')
      .setPlaceholder('Choose a category')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(menu);

    const message = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60_000,
    });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({ content: 'This menu is not for you.', ephemeral: true });
      }
      const selected = i.values[0];
      const catEmbed = buildEmbed(selected, owner, interaction.guildId);
      await i.update({ embeds: [catEmbed], components: [row] });
    });

    collector.on('end', () => {
      row.components[0].setDisabled(true);
      message.edit({ components: [row] }).catch(() => {});
    });
  },
};

