const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');
const { isOwner } = require('../utils/ownerIds');

const categories = {
  'Moderation & Enforcement': [
    { cmd: '/mute', desc: 'Timeout a member for a set duration (reason required)', perm: 'Moderate Members' },
    { cmd: '/kick', desc: 'Remove a member from the server with a required reason', perm: 'Kick Members' },
    { cmd: '/ban', desc: 'Ban a member with optional message pruning (reason required)', perm: 'Ban Members' },
    { cmd: '/purge', desc: 'Bulk delete 1–100 recent messages in the current channel', perm: 'Manage Messages' },
    { cmd: '/blacklist add/remove/list', desc: 'Maintain a join blacklist that automatically bans flagged users', perm: 'Ban Members' },
    { cmd: '/jail config/add/remove/status', desc: 'Temporarily strip roles, isolate members, and restore them later', perm: 'Manage Roles' },
    { cmd: '/smite', desc: 'Spend a Smite to silence a non-staff user for ten minutes', perm: null },
    { cmd: '/smiteconfig', desc: 'Enable or disable Smite rewards and redemption', perm: 'Manage Server' },
  ],
  'Roles & Identity': [
    { cmd: '/role add/remove', desc: 'Grant or remove specific roles from a member', perm: 'Manage Roles' },
    { cmd: '/autoroles add/remove/list/clear', desc: 'Automatically assign roles to new members', perm: 'Manage Roles' },
    { cmd: '/reactionrole create', desc: 'Post an interactive message that lets members pick roles', perm: 'Manage Roles' },
    { cmd: '/verify setup/status/disable/repost', desc: 'Set up button verification with optional account-age rules', perm: 'Manage Server' },
    { cmd: '/createrole', desc: 'Create a role with colour, hoist, mentionable, and position options', perm: 'Manage Roles' },
    { cmd: '/deleterole', desc: 'Delete a role from the server', perm: 'Manage Roles' },
    { cmd: '/brconfig', desc: 'Enable or disable automatic booster custom roles', perm: 'Manage Server' },
    { cmd: '/brsync', desc: 'Sync booster custom roles for existing boosters', perm: 'Manage Server' },
  ],
  'Logging & Security': [
    { cmd: '/modlog set/mode/toggle/show', desc: 'Configure where moderation actions are recorded', perm: 'Manage Server' },
    { cmd: '/securitylog set/mode/clear/toggle/show', desc: 'Decide how permission and hierarchy violations are delivered', perm: 'Manage Server' },
    { cmd: '/logstream setchannel/toggle/show', desc: 'Stream high-volume server events to a live log channel', perm: 'Manage Server' },
    { cmd: '/logchannels add/remove/list', desc: 'Watch channels for admin deletions and DM bot owners', perm: 'Manage Channels' },
    { cmd: '/logconfig', desc: 'Review the status of moderation, security, and channel logging', perm: 'Manage Server' },
    { cmd: '/antinuke config', desc: 'Configure anti-nuke safeguards and view their current status', perm: 'Manage Server' },
    { cmd: '/joins leaderboard/user/setlog/backfill', desc: 'Track join/leave stats and import historical logs', perm: 'Manage Server' },
    { cmd: '/voiceauto enable/disable/status', desc: 'Enable automatic voice transcription in chosen channels', perm: 'Manage Server' },
    { cmd: '/securityreport', desc: 'Report members frequently triggering permission or hierarchy issues', perm: 'Manage Server' },
  ],
  'Server Setup & Messaging': [
    { cmd: '/welcome setup/status/disable/test', desc: 'Build and manage welcome messages for new members', perm: 'Manage Server' },
    { cmd: '/leave setup/status/disable/test', desc: 'Send customised farewells when members depart', perm: 'Manage Server' },
    { cmd: '/confessconfig', desc: 'Post the anonymous confession button to a channel', perm: 'Manage Server' },
    { cmd: '/createchannel', desc: 'Quickly create text, voice, or stage channels with optional category', perm: 'Manage Channels' },
    { cmd: '/channelsync', desc: 'Sync child channels with their category permissions', perm: 'Manage Channels' },
    { cmd: '/autorespond toggle/add/remove/list', desc: 'Automate keyword replies with optional channel filters', perm: 'Administrator' },
    { cmd: '/repeat start/stop/list', desc: 'Schedule repeating messages every N seconds (≥ 60)', perm: 'Administrator' },
    { cmd: '/say', desc: 'Send a custom message as the bot in any channel you specify', perm: 'Administrator' },
    { cmd: '/servertag set/show/clear', desc: 'Store a server tag for quick reference across commands', perm: 'Manage Server' },
  ],
  'Media & Personalisation': [
    { cmd: '/chat', desc: 'Chat with GPT using selectable personas and context sizes', perm: null },
    { cmd: '/analysis', desc: 'Spend a Judgement to analyse your recent messages for insights', perm: null },
    { cmd: '/summarize', desc: 'Summarise recent channel messages into bullets and a paragraph', perm: null },
    { cmd: '/transcribe', desc: 'Transcribe an attached audio file using Whisper', perm: null },
    { cmd: '/removebg', desc: 'Remove the background from an image via remove.bg', perm: null },
    { cmd: '/highdef', desc: 'Upscale and enhance an image using AI', perm: null },
    { cmd: '/imageresize', desc: 'Resize an image and convert it to PNG', perm: null },
    { cmd: '/enlarge emoji/sticker', desc: 'Post a large version of any emoji or sticker', perm: null },
    { cmd: '/clone emoji/sticker', desc: 'Clone emojis or stickers by mention, ID, URL, or upload', perm: 'Manage Emojis and Stickers' },
    { cmd: '/cloneall', desc: 'Bulk clone emojis from another server with filters', perm: 'Manage Emojis and Stickers' },
  ],
  'Embeds & Branding': [
    { cmd: '/embed create/quick', desc: 'Use a guided builder or quick form to craft embeds', perm: null },
    { cmd: '/getembed', desc: 'Extract embed JSON from a message for reuse', perm: null },
    { cmd: '/colour set/get/reset', desc: 'Manage the saved default embed colour for this server', perm: 'Manage Server' },
    { cmd: '/setdefaultcolour & /getdefaultcolour', desc: 'Quick commands to update or view the default embed colour', perm: 'Manage Server (setdefaultcolour)' },
    { cmd: '/bremblem', desc: 'Upload or clear the emblem on your booster custom role', perm: null },
    { cmd: '/brcolor', desc: 'Choose a solid or gradient colour for your booster role', perm: null },
    { cmd: '/brname', desc: 'Rename your booster custom role safely', perm: null },
  ],
  'Economy & Games': [
    { cmd: '/inventory', desc: 'Check your coins plus available Smites and Judgements', perm: null },
    { cmd: '/store', desc: 'Spend coins on Smite Tomes or Judgement Seals', perm: null },
    { cmd: '/pray', desc: 'Pray once per day to receive a coin blessing', perm: null },
    { cmd: '/horserace', desc: 'Host a chaotic horse race mini-game with your server', perm: null },
    { cmd: '/horseracestandings', desc: 'Review historical podium finishes or personal stats', perm: null },
    { cmd: '/triviastart', desc: 'Start a multi-round trivia match in the channel', perm: null },
    { cmd: '/triviastop', desc: 'End an active trivia session early', perm: null },
    { cmd: '/triviacategories', desc: 'Browse the available trivia categories and difficulties', perm: null },
    { cmd: '/triviarankings', desc: 'Show the trivia leaderboard for this server', perm: null },
  ],
  'Utilities & Insights': [
    { cmd: '/avatar', desc: 'View any user’s avatar with quick download links', perm: null },
    { cmd: '/avatarhistory', desc: 'Browse a user’s historical avatars via Discord Lookup', perm: null },
    { cmd: '/serverbanner', desc: 'Display and download the server banner', perm: null },
    { cmd: '/serverlogo', desc: 'Display and download the server icon', perm: null },
    { cmd: '/botinfo', desc: 'See which bot instance responded, uptime, and loaded commands', perm: null },
    { cmd: '/webhooks', desc: 'List every webhook in the server and its creator', perm: 'Manage Webhooks' },
  ],
  'Bot Owner': [
    { cmd: '/adminlist', desc: 'List mutual guilds where a user has Administrator', perm: 'Bot Owner' },
    { cmd: '/botlook', desc: 'Update the bot avatar, nickname, or bio', perm: 'Bot Owner' },
    { cmd: '/fetchmessage', desc: 'Backfill user messages from a channel for analysis tools', perm: 'Bot Owner' },
    { cmd: '/dmdiag test/role', desc: 'Run DM diagnostics for a member or role', perm: 'Bot Owner' },
    { cmd: '/givejudgement', desc: 'Grant Judgements directly to a user', perm: 'Bot Owner or Guild Owner' },
    { cmd: '/wraith start/stop', desc: 'Create a private spam channel and isolate a member', perm: 'Bot Owner' },
  ],
};

const categoryMeta = {
  'Moderation & Enforcement': {
    emoji: '🛡️',
    blurb: 'Act fast on rule breakers and keep order in your community.',
  },
  'Roles & Identity': {
    emoji: '🧩',
    blurb: 'Manage roles, verification, and booster perks with ease.',
  },
  'Logging & Security': {
    emoji: '🛰️',
    blurb: 'Audit key events and surface potential security concerns.',
  },
  'Server Setup & Messaging': {
    emoji: '🧰',
    blurb: 'Configure channels, announcements, and custom automations.',
  },
  'Media & Personalisation': {
    emoji: '🤖',
    blurb: 'Transform media and tap into AI-powered workflows.',
  },
  'Embeds & Branding': {
    emoji: '🖌️',
    blurb: 'Craft stunning embeds and customise booster flair.',
  },
  'Economy & Games': {
    emoji: '🎲',
    blurb: 'Reward activity, run events, and keep members entertained.',
  },
  'Utilities & Insights': {
    emoji: '🧭',
    blurb: 'Handy diagnostics and quick lookups for everyday needs.',
  },
  'Bot Owner': {
    emoji: '👑',
    blurb: 'Exclusive controls reserved for bot owners.',
  },
};

function buildEmbed(categoryName, includeOwner, guildId, botUser) {
  const embed = new EmbedBuilder()
    .setTitle('✨ Command Compass')
    .setColor(0x5865f2)
    .setFooter({
      text: 'Use the selector below to explore — it disables after one minute.',
    })
    .setTimestamp();

  const avatarURL =
    typeof botUser?.displayAvatarURL === 'function'
      ? botUser.displayAvatarURL({ size: 256 })
      : null;

  if (avatarURL) {
    embed.setThumbnail(avatarURL);
    embed.setAuthor({
      name: botUser.username ?? 'Dusscord Help',
      iconURL: avatarURL,
    });
  }

  try {
    const { applyDefaultColour } = require('../utils/guildColourStore');
    applyDefaultColour(embed, guildId);
  } catch (_) {}

  if (categoryName && categories[categoryName]) {
    if (categoryName === 'Bot Owner' && !includeOwner) {
      embed.setDescription('Owner-only commands are hidden.');
      return embed;
    }
    const meta = categoryMeta[categoryName] ?? {};
    const emoji = meta.emoji ?? '📘';
    const blurb = meta.blurb ? `\n_${meta.blurb}_` : '';
    embed.setDescription(`${emoji} **${categoryName} Commands**${blurb}`);
    const fields = categories[categoryName].map(({ cmd, desc, perm }) => ({
      name: `${emoji} ${cmd}`,
      value: `_${desc}_${perm ? `\n> **Requires:** ${perm}` : ''}`,
      inline: false,
    }));
    embed.addFields(fields);
    return embed;
  }

  embed.setDescription('✨ Explore the command vault and find the perfect tool in seconds.');
  const cats = Object.keys(categories).filter(
    (cat) => !(cat === 'Bot Owner' && !includeOwner)
  );
  const value = cats
    .map((c) => {
      const { emoji, blurb } = categoryMeta[c] ?? {};
      const accent = blurb ? ` — ${blurb}` : '';
      return `${emoji ?? '📘'} **${c}**${accent}`;
    })
    .join('\n');
  embed.addFields(
    { name: '📚 Categories', value },
    {
      name: 'Need a quick tip?',
      value: 'Use `/help` anytime to reopen this menu or explore another category.',
    }
  );
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with the bot'),

  async execute(interaction) {
    const owner = isOwner(interaction.user.id);
    const embed = buildEmbed(
      null,
      owner,
      interaction.guildId,
      interaction.client.user
    );

    const options = Object.keys(categories)
      .filter((c) => !(c === 'Bot Owner' && !owner))
      .map((c) => {
        const meta = categoryMeta[c] ?? {};
        const option = { label: c, value: c };
        if (meta.emoji) option.emoji = meta.emoji;
        if (meta.blurb) option.description = meta.blurb;
        return option;
      });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('help-category')
      .setPlaceholder('✨ Browse a command category')
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
      const catEmbed = buildEmbed(
        selected,
        owner,
        interaction.guildId,
        interaction.client.user
      );
      await i.update({ embeds: [catEmbed], components: [row] });
    });

    collector.on('end', () => {
      row.components[0].setDisabled(true);
      message.edit({ components: [row] }).catch(() => {});
    });
  },
};

