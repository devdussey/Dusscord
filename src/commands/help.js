const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function isOwner(userId) {
  const raw = process.env.BOT_OWNER_IDS || '';
  const ids = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  return ids.includes(String(userId));
}

// Reorganized sections
const categories = {
  'Moderation': [
    ['/- mute', 'Timeout a member (10m, 1h, 2d). Requires Moderate Members.'],
    ['/- kick', 'Kick a member. Requires Kick Members.'],
    ['/- ban', 'Ban a user; optional prune_days (0–7). Requires Ban Members.'],
    ['/- purge', 'Delete 1–100 recent messages here. Requires Manage Messages.'],
  ],
  'Roles': [
    ['/- autoroles add/remove/list/clear', 'Auto-assign roles on join. Requires Manage Roles.'],
    ['/- role add/remove', 'Add or remove a specific role. Requires Manage Roles.'],
  ],
  'Emoji & Stickers': [
    ['/- clone emoji', 'Clone a custom emoji by mention/ID/URL.'],
    ['/- clone sticker', 'Clone a sticker by ID/URL or upload.'],
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
    ['/- securitylog set/clear/show', 'Per-guild channel for security logs (fallback to DM owners).'],
    ['/- logchannels', 'Show configured log channels.'],
    ['/- securityreport', 'Who triggered permission/hierarchy/missing-command events.'],
  ],
  'Media Tools': [
    ['/- removebg', 'Remove image background (API key required).'],
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

function buildEmbed(categoryName, userTag, client, includeOwner) {
  const embed = new EmbedBuilder()
    .setTitle('Bot Help')
    .setColor('#0099ff')
    .setFooter({ text: `Requested by ${userTag}`, iconURL: client.user.displayAvatarURL() });

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

    const embed = buildEmbed(cat, interaction.user.tag, interaction.client, owner);
    try {
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      try {
        if (interaction.channel && interaction.channel.send) {
          await interaction.channel.send({ content: `Here you go, <@${interaction.user.id}>:`, embeds: [embed] });
        }
      } catch (_) {}
    }
  },
};
