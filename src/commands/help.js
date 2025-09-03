const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const categories = {
  'Moderation': [
    ['/- mute', 'Timeout a member (10m, 1h, 2d). Requires Moderate Members.'],
    ['/- kick', 'Kick a member. Requires Kick Members.'],
    ['/- ban', 'Ban a user; optional prune_days (0–7). Requires Ban Members.'],
    ['/- purge', 'Delete 1–100 recent messages here. Requires Manage Messages.'],
  ],
  'Roles & Config': [
    ['/- autoroles add/remove/list/clear', 'Auto-assign roles on join. Requires Manage Roles.'],
    ['/- role add/remove', 'Add or remove a specific role. Requires Manage Roles.'],
    ['/- securitylog set/clear/show', 'Per‑guild channel for security logs (fallback to DM owners).'],
  ],
  'Emoji & Stickers': [
    ['/- clone emoji', 'Clone a custom emoji by mention/ID/URL.'],
    ['/- clone sticker', 'Clone a sticker by ID/URL or upload.'],
    ['/- enlarge emoji', 'Post a large emoji (supports Unicode).'],
    ['/- enlarge sticker', 'Post a sticker file as an image.'],
  ],
  'Join/Leave Stats': [
    ['/- joins leaderboard', 'Top joiners/leavers (optionally by window).'],
    ['/- joins user', 'Stats for a specific member.'],
    ['/- joins setlog', 'Link your existing join/leave log channel + keywords.'],
    ['/- joins backfill', 'Import historical join/leave events from linked channel.'],
  ],
  'Logging & Security': [
    ['/- logchannels', 'logging'],
    ['/- securityreport', 'Who triggered permission/hierarchy/missing‑command events.'],
  ],
  'Utilities': [
    ['/- embed create', 'Open modal to build an embed.'],
    ['/- embed quick', 'Quick embed (description, title, color, etc.).'],
    ['/- getembed', 'Extract embed JSON from a message.'],
    ['/- removebg', 'Remove image background (API key required).'],
    ['/- botinfo', 'Show instance, mode, commands loaded, uptime.'],
  ],
  'Owner Only': [
    ['/- adminlist', '\u200B'],
    ['/- dmdiag test', 'Tests the Bots Direct Message System and Blacklisted Roles'],
    ['/- dmdiag role', 'Tests the Bots Direct Message System and Blacklisted Roles'],
  ],
};

function buildEmbed(categoryName, userTag, client) {
  const embed = new EmbedBuilder()
    .setTitle('Bot Help')
    .setColor('#0099ff')
    .setFooter({ text: `Requested by ${userTag}`, iconURL: client.user.displayAvatarURL() });

  if (categoryName && categories[categoryName]) {
    embed.setDescription(`${categoryName}`);
    const fields = categories[categoryName].map(([name, value]) => ({ name: name.replace('/-', '/'), value, inline: false }));
    embed.addFields(fields);
    return embed;
  }

  embed.setDescription('Overview of available commands (grouped)');
  for (const [cat, items] of Object.entries(categories)) {
    const value = items.map(([name, value]) => `• ${name.replace('/-', '/')} — ${value}`).join('\n');
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
          { name: 'Roles & Config', value: 'Roles & Config' },
          { name: 'Emoji & Stickers', value: 'Emoji & Stickers' },
          { name: 'Join/Leave Stats', value: 'Join/Leave Stats' },
          { name: 'Logging & Security', value: 'Logging & Security' },
          { name: 'Utilities', value: 'Utilities' },
          { name: 'Owner Only', value: 'Owner Only' },
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    const cat = interaction.options.getString('category');
    const embed = buildEmbed(cat, interaction.user.tag, interaction.client);
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

