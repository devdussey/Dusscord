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
    { cmd: '/mute', desc: 'Timeout a member (10m, 1h, 2d)', perm: 'Moderate Members' },
    { cmd: '/kick', desc: 'Kick a member', perm: 'Kick Members' },
    { cmd: '/ban', desc: 'Ban a user; optional prune_days (0–7)', perm: 'Ban Members' },
    { cmd: '/blacklist add/remove/list', desc: 'Blacklist users to auto-ban on join', perm: 'Ban Members' },
    { cmd: '/purge', desc: 'Delete 1–100 recent messages here', perm: 'Manage Messages' },
    { cmd: '/jail config/add/remove/status', desc: 'Jail system to restrict and restore members', perm: 'Manage Roles' },
  ],
  Roles: [
    { cmd: '/autoroles add/remove/list/clear', desc: 'Auto-assign roles on join', perm: 'Manage Roles' },
    { cmd: '/role add/remove', desc: 'Add or remove a specific role', perm: 'Manage Roles' },
    { cmd: '/createrole', desc: 'Quickly create a role', perm: 'Manage Roles' },
    { cmd: '/deleterole', desc: 'Delete a role', perm: 'Manage Roles' },
    { cmd: '/reactionrole create', desc: 'Create an embed with a selectable role menu', perm: 'Manage Roles' },
  ],
  'Emoji & Stickers': [
    { cmd: '/clone emoji', desc: 'Clone a custom emoji by mention/ID/URL', perm: null },
    { cmd: '/clone sticker', desc: 'Clone a sticker by ID/URL or upload', perm: null },
    { cmd: '/cloneall', desc: 'Clone emojis from another server by ID', perm: null },
    { cmd: '/enlarge emoji', desc: 'Post a large emoji (supports Unicode)', perm: null },
    { cmd: '/enlarge sticker', desc: 'Post a sticker file as an image', perm: null },
  ],
  Embeds: [
    { cmd: '/embed create', desc: 'Open modal to build an embed', perm: null },
    { cmd: '/embed quick', desc: 'Quick embed (description, title, color, etc.)', perm: null },
    { cmd: '/getembed', desc: 'Extract embed JSON from a message', perm: null },
  ],
  'Member Stats': [
    { cmd: '/joins leaderboard', desc: 'Top joiners/leavers (optionally by window)', perm: null },
    { cmd: '/joins user', desc: 'Stats for a specific member', perm: null },
    { cmd: '/joins setlog', desc: 'Link your existing join/leave log channel + keywords', perm: null },
    { cmd: '/joins backfill', desc: 'Import historical join/leave events from linked channel', perm: null },
  ],
  Security: [
    { cmd: '/securitylog set/clear/show', desc: 'Configure security log channel and view settings', perm: null },
    { cmd: '/securitylog mode', desc: 'Choose delivery: channel, owners, or both', perm: null },
    { cmd: '/securitylog toggle', desc: 'Enable or disable security logging as a whole', perm: null },
    {
      cmd: '/modlog set/mode/toggle/show',
      desc: 'Configure moderation action logging (bans, kicks, mutes, role changes)',
      perm: null,
    },
    { cmd: '/logchannels', desc: 'Show configured log channels', perm: null },
    { cmd: '/logconfig', desc: 'Show status of all logging categories', perm: null },
    { cmd: '/securityreport', desc: 'Who triggered permission/hierarchy/missing-command events', perm: null },
    { cmd: '/channelsync', desc: 'Sync channels to their category permissions', perm: 'Manage Channels' },
  ],
  'Media Tools': [
    { cmd: '/removebg', desc: 'Remove image background (API key required)', perm: null },
    { cmd: '/transcribe', desc: 'Transcribe an attached audio file (OpenAI API)', perm: null },
    { cmd: '/summarize', desc: 'Summarize provided text or a text file (OpenAI)', perm: null },
    { cmd: '/voiceauto enable/disable/status', desc: 'Configure automatic voice transcription channels', perm: 'Manage Server' },
  ],
  System: [
    { cmd: '/botinfo', desc: 'Show instance, mode, commands loaded, uptime', perm: null },
    { cmd: '/webhooks', desc: 'List server webhooks and their creators', perm: 'Manage Webhooks' },
  ],
  'Owner Only': [
    { cmd: '/adminlist', desc: '\u200B', perm: null },
    { cmd: '/dmdiag test', desc: 'Tests the bot’s direct messages and blacklisted roles', perm: null },
    { cmd: '/dmdiag role', desc: 'Tests the bot’s direct messages and blacklisted roles', perm: null },
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

