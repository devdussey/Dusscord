const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const store = require('../utils/joinLeaveStore');
const cfgStore = require('../utils/joinLogConfigStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joins')
    .setDescription('Join/leave stats and leaderboard')
    .addSubcommand(sub =>
      sub
        .setName('leaderboard')
        .setDescription('Show the top joiners/leavers')
        .addStringOption(opt =>
          opt.setName('type').setDescription('Which leaderboard').addChoices(
            { name: 'Joins', value: 'join' },
            { name: 'Leaves', value: 'leave' },
            { name: 'Both (total)', value: 'both' },
          ).setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('days').setDescription('Lookback window in days (omit for all time)').setMinValue(1).setMaxValue(365).setRequired(false)
        )
        .addIntegerOption(opt =>
          opt.setName('limit').setDescription('How many to show').setMinValue(3).setMaxValue(25).setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('user')
        .setDescription('Show stats for a specific user')
        .addUserOption(opt => opt.setName('member').setDescription('Member to check').setRequired(true))
        .addIntegerOption(opt => opt.setName('days').setDescription('Lookback window in days (omit for all time)').setMinValue(1).setMaxValue(365).setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('setlog')
        .setDescription('Link an existing join/leave log channel for backfill')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel where your join/leave logs are posted')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('join_kw').setDescription('Keywords to detect joins (comma-separated). Default: joined,welcome')
        )
        .addStringOption(opt =>
          opt.setName('leave_kw').setDescription('Keywords to detect leaves (comma-separated). Default: left,leave,departed')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('backfill')
        .setDescription('Scan the linked log channel and import join/leave events')
        .addIntegerOption(opt => opt.setName('limit').setDescription('Max messages to scan (default 1000)').setMinValue(50).setMaxValue(10000))
        .addChannelOption(opt => opt.setName('channel').setDescription('Override: specific channel to scan').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    await interaction.deferReply();

    const sub = interaction.options.getSubcommand();
    if (sub === 'leaderboard') {
      const type = interaction.options.getString('type') || 'join';
      const days = interaction.options.getInteger('days');
      const limit = interaction.options.getInteger('limit') ?? 10;
      const sinceMs = days ? days * 24 * 60 * 60 * 1000 : null;

      const rows = store.getLeaderboard(interaction.guildId, type, sinceMs, limit);
      if (!rows.length) return interaction.editReply({ content: 'No data recorded yet.' });

      const lines = await Promise.all(rows.map(async (r, i) => {
        const user = await interaction.client.users.fetch(r.userId).catch(() => null);
        const name = user ? `${user.tag}` : `Unknown (${r.userId})`;
        const body = type === 'both' ? `${r.total} total (joins ${r.joins} / leaves ${r.leaves})` : `${type === 'join' ? r.joins : r.leaves}`;
        return `${i + 1}. ${name} — ${body}`;
      }));

      const title = type === 'leave' ? 'Top Leaves' : type === 'join' ? 'Top Joins' : 'Top Joins/Leaves (Total)';
      const embed = new EmbedBuilder().setTitle(title).setColor(0x0000ff).setDescription(lines.join('\n'));
      if (days) embed.setFooter({ text: `Window: last ${days} day(s)` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'user') {
      const member = interaction.options.getUser('member', true);
      const days = interaction.options.getInteger('days');
      const sinceMs = days ? days * 24 * 60 * 60 * 1000 : null;
      const stats = store.getUserStats(interaction.guildId, member.id, sinceMs);
      const embed = new EmbedBuilder()
        .setTitle(`Join/Leave Stats — ${member.tag}`)
        .setColor(0x0000ff)
        .addFields(
          { name: 'Joins', value: String(stats.joins || 0), inline: true },
          { name: 'Leaves', value: String(stats.leaves || 0), inline: true },
        );
      if (stats.lastJoinAt) embed.addFields({ name: 'Last Join', value: `<t:${Math.floor(stats.lastJoinAt/1000)}:R>`, inline: true });
      if (stats.lastLeaveAt) embed.addFields({ name: 'Last Leave', value: `<t:${Math.floor(stats.lastLeaveAt/1000)}:R>`, inline: true });
      if (days) embed.setFooter({ text: `Window: last ${days} day(s)` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'setlog') {
      if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.editReply({ content: 'You need Manage Server to configure this.' });
      }
      const ch = interaction.options.getChannel('channel', true);
      const joinKw = (interaction.options.getString('join_kw') || 'joined,welcome').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      const leaveKw = (interaction.options.getString('leave_kw') || 'left,leave,departed').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      cfgStore.setConfig(interaction.guildId, { channelId: ch.id, joinKw, leaveKw });
      return interaction.editReply({ content: `Linked log channel to ${ch}. Join keywords: ${joinKw.join(', ')} | Leave keywords: ${leaveKw.join(', ')}` });
    }

    if (sub === 'backfill') {
      if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.editReply({ content: 'You need Manage Server to run backfill.' });
      }

      const overrideCh = interaction.options.getChannel('channel');
      const limit = interaction.options.getInteger('limit') ?? 1000;
      const cfg = cfgStore.getConfig(interaction.guildId);
      const channelId = overrideCh?.id || cfg?.channelId;
      if (!channelId) return interaction.editReply({ content: 'No channel provided and none linked. Use /joins setlog first or pass channel.' });
      const channel = interaction.guild.channels.cache.get(channelId) || await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased?.()) return interaction.editReply({ content: 'Invalid channel.' });

      const joinKw = (cfg?.joinKw && cfg.joinKw.length) ? cfg.joinKw : ['joined', 'welcome'];
      const leaveKw = (cfg?.leaveKw && cfg.leaveKw.length) ? cfg.leaveKw : ['left', 'leave', 'departed'];

      let scanned = 0, joins = 0, leaves = 0;
      let before = undefined;
      const batchSize = 100;
      const joinRegex = new RegExp(`\\b(${joinKw.map(k=>escapeRegex(k)).join('|')})\\b`, 'i');
      const leaveRegex = new RegExp(`\\b(${leaveKw.map(k=>escapeRegex(k)).join('|')})\\b`, 'i');
      while (scanned < limit) {
        const remaining = Math.min(batchSize, limit - scanned);
        const msgs = await channel.messages.fetch({ limit: remaining, before }).catch(() => null);
        if (!msgs || msgs.size === 0) break;
        for (const msg of msgs.values()) {
          scanned++;
          before = msg.id;
          const text = (msg.content || '').toLowerCase();
          const isJoin = joinRegex.test(text);
          const isLeave = !isJoin && leaveRegex.test(text);
          if (!isJoin && !isLeave) continue;
          // identify users: prefer mentions
          const ids = new Set(msg.mentions?.users?.map(u => u.id) || []);
          // fallback: match <@123> or raw 17-19 digit ids
          const mentionIds = Array.from((msg.content || '').matchAll(/<@!?(\d{15,25})>/g)).map(m => m[1]);
          for (const id of mentionIds) ids.add(id);
          if (ids.size === 0) continue;
          for (const id of ids) {
            try {
              store.addEvent(interaction.guildId, id, isJoin ? 'join' : 'leave', msg.createdTimestamp || Date.now(), { messageId: msg.id, sourceChannelId: channel.id });
              if (isJoin) joins++; else leaves++;
            } catch (err) { console.error('src/commands/joins.js', err); }
          }
        }
        if (msgs.size < remaining) break; // no more messages
      }
      return interaction.editReply({ content: `Backfill complete. Scanned ${scanned} messages. Imported Joins: ${joins}, Leaves: ${leaves}.` });
    }

    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
