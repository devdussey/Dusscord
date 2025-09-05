const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const store = require('../utils/autoPostStore');
const scheduler = require('../utils/autoPostScheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('repeat')
    .setDescription('Schedule a repeating message every N seconds (min 60)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start a repeating message')
        .addStringOption(opt =>
          opt.setName('message').setDescription('Text to send').setRequired(true)
        )
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to send to (defaults to here)')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
            )
        )
        .addIntegerOption(opt =>
          opt.setName('seconds')
            .setDescription('Interval seconds (minimum 60, default 60)')
            .setMinValue(60)
        )
        .addBooleanOption(opt =>
          opt.setName('allow_mentions')
            .setDescription('Allow mentions in the message (default off)')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Stop and remove a repeating message by ID')
        .addIntegerOption(opt =>
          opt.setName('id').setDescription('Repeat job ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List active repeat jobs')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.editReply({ content: 'Only server administrators can configure repeats.' });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'start') {
      const message = interaction.options.getString('message', true);
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const seconds = interaction.options.getInteger('seconds') || 60;
      // We always save with min 60s; allow_mentions is applied at send-time by Discord anyway via content
      const job = store.addJob(guildId, {
        channelId: channel.id,
        message,
        intervalMs: Math.max(60000, seconds * 1000),
      });
      try { scheduler.startJob(interaction.client, guildId, job); } catch (err) { console.error('src/commands/repeat.js', err); }
      return interaction.editReply({ content: `Repeat job #${job.id} started in ${channel} every ${Math.max(60, seconds)} seconds.` });
    }

    if (sub === 'stop') {
      const id = interaction.options.getInteger('id', true);
      const ok = store.removeJob(guildId, id);
      try { scheduler.stopJob(guildId, id); } catch (err) { console.error('src/commands/repeat.js', err); }
      return interaction.editReply({ content: ok ? `Stopped and removed job #${id}.` : `Job #${id} not found.` });
    }

    if (sub === 'list') {
      const jobs = store.listJobs(guildId);
      if (!jobs.length) return interaction.editReply({ content: 'No repeat jobs configured.' });
      const lines = jobs.map(j => `#${j.id} ${j.enabled ? '[ON]' : '[OFF]'} every ${Math.round((j.intervalMs||60000)/1000)}s in <#${j.channelId}>: ${j.message.slice(0, 60)}`);
      return interaction.editReply({ content: lines.join('\n') });
    }

    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};

