const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function isOwner(userId) {
  const raw = process.env.BOT_OWNER_IDS || '';
  const ids = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  return ids.includes(String(userId));
}

const categories = {
  'Moderation': [
    ['/- mute', 'Timeout a member (10m, 1h, 2d). Requires Moderate Members.'],
    ['/- kick', 'Kick a member. Requires Kick Members.'],
    ['/- ban', 'Ban a user; optional prune_days (0–7). Requires Ban Members.'],
    ['/- purge', 'Delete 1–100 recent messages here. Requires Manage Messages.'],
    ['/- jail config/add/remove/status', 'Jail system to restrict and restore members. Requires Manage Roles.'],
  ],
  'Roles': [
    ['/- autoroles add/remove/list/clear', 'Auto-assign roles on join. Requires Manage Roles.'],
    ['/- role add/remove', 'Add or remove a specific role. Requires Manage Roles.'],
    ['/- createrole', 'Quickly create a role. Requires Manage Roles.'],
    ['/- deleterole', 'Delete a role. Requires Manage Roles.'],
    ['/- reactionrole create', 'Create an embed with a selectable role menu. Requires Manage Roles.'],
  ],
  'Emoji & Stickers': [
    ['/- clone emoji', 'Clone a custom emoji by mention/ID/URL.'],
    ['/- clone sticker', 'Clone a sticker by ID/URL or upload.'],
    ['/- cloneall', 'Clone emojis from another server by ID.'],
    ['/- enlarge emoji', 'Post a large emoji (supports Unicode).'],
    ['/- enlarge sticker', 'Post a sticker file as an image.'],
  ],
  'Embeds': [
    ['/- embed create', 'Open modal to build an embed.'],
    ['/- embed quick', 'Quick embed (description, title, color, etc.).'],
    ['/- getembed', 'Extract embed JSON from a message.'],
  ],
  'Member Stats': [
    ['/- joins leaderboard', 'Top joiners/leavers (optionally by window).'],
    ['/- joins user', 'Stats for a specific member.'],
    ['/- joins setlog', 'Link your existing join/leave log channel + keywords.'],
    ['/- joins backfill', 'Import historical join/leave events from linked channel.'],
  ],
  'Security': [
    ['/- securitylog set/clear/show', 'Configure security log channel and view settings.'],
    ['/- securitylog mode', 'Choose delivery: channel, owners, or both.'],
    ['/- securitylog toggle', 'Enable or disable security logging as a whole.'],
    ['/- modlog set/mode/toggle/show', 'Configure moderation action logging (bans, kicks, mutes, role changes).'],
    ['/- logchannels', 'Show configured log channels.'],
    ['/- securityreport', 'Who triggered permission/hierarchy/missing-command events.'],
    ['/- channelsync', 'Sync channels to their category permissions. Requires Manage Channels.'],
  ],
  'Media Tools': [
    ['/- removebg', 'Remove image background (API key required).'],
    ['/- transcribe', 'Transcribe an attached audio file (OpenAI API).'],
    ['/- summarize', 'Summarize provided text or a text file (OpenAI).'],
  ],
  'System': [
    ['/- botinfo', 'Show instance, mode, commands loaded, uptime.'],
  ],
  'Owner Only': [
    ['/- adminlist', '\u200B'],
    ['/- dmdiag test', 'Tests the bot’s direct messages and blacklisted roles'],
    ['/- dmdiag role', 'Tests the bot’s direct messages and blacklisted roles'],
  ],
};

function buildEmbed(categoryName, includeOwner, guildId) {
  const embed = new EmbedBuilder()
    .setTitle('Bot Help');
  try {
    const { applyDefaultColour } = require('../utils/guildColourStore');
    applyDefaultColour(embed, guildId);
  } catch (_) {}

  if (categoryName && categories[categoryName]) {
    if (categoryName === 'Owner Only' && !includeOwner) {
      embed.setDescription('Owner-only commands are hidden.');
      return embed;
    }
    embed.setDescription(`${categoryName}`);
    const fields = categories[categoryName].map(([name, value]) => ({ name: name.replace('/-', '/'), value, inline: false }));
    embed.addFields(fields);
    return embed;
  }

  embed.setDescription('Overview of available commands (grouped)');
  for (const [cat, items] of Object.entries(categories)) {
    if (cat === 'Owner Only' && !includeOwner) continue;
    const value = items.map(([name, value]) => `• ${name.replace('/-', '/') } — ${value}`).join('\n');
    embed.addFields({ name: cat, value, inline: false });
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with the bot')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Filter by category')
        .addChoices(
          { name: 'Moderation', value: 'Moderation' },
          { name: 'Roles', value: 'Roles' },
          { name: 'Emoji & Stickers', value: 'Emoji & Stickers' },
          { name: 'Embeds', value: 'Embeds' },
          { name: 'Member Stats', value: 'Member Stats' },
          { name: 'Security', value: 'Security' },
          { name: 'Media Tools', value: 'Media Tools' },
          { name: 'System', value: 'System' },
          { name: 'Owner Only', value: 'Owner Only' },
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    const cat = interaction.options.getString('category');
    const owner = isOwner(interaction.user.id);

    if (cat === 'Owner Only' && !owner) {
      return interaction.reply({ content: 'This category is only visible to bot owners.', ephemeral: true });
    }

    const embed = buildEmbed(cat, owner, interaction.guildId);
    try {
      await interaction.reply({ embeds: [embed] });
    } catch (_) {
      try {
        if (interaction.channel && interaction.channel.send) {
          await interaction.channel.send({ embeds: [embed] });
        }
      } catch (_) {}
    }
  },
};
