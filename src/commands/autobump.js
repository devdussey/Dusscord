const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const store = require('../utils/autoBumpStore');
const scheduler = require('../utils/autoBumpScheduler');
const { getService, getServiceChoices, getDefaultIntervalMs, getDefaultCommand } = require('../utils/autoBumpServices');

const MIN_INTERVAL_MINUTES = 5;
const MAX_INTERVAL_MINUTES = 24 * 60;

function clampIntervalMinutes(minutes, fallbackMs) {
  if (Number.isNaN(minutes) || minutes <= 0) {
    return Math.round((fallbackMs || 60_000) / 60_000);
  }
  return Math.min(Math.max(minutes, MIN_INTERVAL_MINUTES), MAX_INTERVAL_MINUTES);
}

function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms)) return 'soon';
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length && seconds) parts.push(`${seconds}s`);
  return parts.length ? parts.join(' ') : 'now';
}

function formatRelative(targetMs) {
  if (!targetMs) return 'soon';
  const diff = targetMs - Date.now();
  if (diff <= 0) return 'soon';
  return `in ${formatDuration(diff)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autobump')
    .setDescription('Automatically send bump commands for listing sites')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .setDMPermission(false)
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Create a new bump schedule')
        .addStringOption(opt =>
          opt
            .setName('service')
            .setDescription('Listing service to bump')
            .setRequired(true)
            .addChoices(...getServiceChoices())
        )
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel to run the bump command in')
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.GuildAnnouncement,
              ChannelType.PublicThread,
              ChannelType.PrivateThread,
            )
        )
        .addStringOption(opt =>
          opt
            .setName('command')
            .setDescription('Override the command text (defaults per service)')
            .setMaxLength(2000)
        )
        .addIntegerOption(opt =>
          opt
            .setName('interval_minutes')
            .setDescription('Minutes between bumps (defaults per service)')
            .setMinValue(MIN_INTERVAL_MINUTES)
            .setMaxValue(MAX_INTERVAL_MINUTES)
        )
        .addIntegerOption(opt =>
          opt
            .setName('start_after_minutes')
            .setDescription('Delay before the first bump runs (default 1 minute)')
            .setMinValue(1)
            .setMaxValue(12 * 60)
        )
        .addBooleanOption(opt =>
          opt
            .setName('allow_mentions')
            .setDescription('Allow mentions in the bump command (default off)')
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Delete a bump schedule')
        .addIntegerOption(opt =>
          opt
            .setName('id')
            .setDescription('Autobump job ID')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('enable')
        .setDescription('Enable a bump schedule that is currently disabled')
        .addIntegerOption(opt =>
          opt
            .setName('id')
            .setDescription('Autobump job ID')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('disable')
        .setDescription('Disable a bump schedule without deleting it')
        .addIntegerOption(opt =>
          opt
            .setName('id')
            .setDescription('Autobump job ID')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List configured bump schedules')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    const memberPerms = interaction.member?.permissions;
    if (!memberPerms?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need the Manage Server permission to use /autobump.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'add') {
      await interaction.deferReply({ ephemeral: true });
      const serviceKey = interaction.options.getString('service', true);
      const service = getService(serviceKey);
      if (!service) {
        return interaction.editReply({ content: 'Unknown service selected.' });
      }
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (!channel || !channel.isTextBased()) {
        return interaction.editReply({ content: 'Select a text-based channel for bumps.' });
      }

      let customCommand = interaction.options.getString('command');
      if (!customCommand || !customCommand.trim()) {
        customCommand = getDefaultCommand(serviceKey);
      }
      if (!customCommand || !customCommand.trim()) {
        return interaction.editReply({ content: 'Please provide a command for this service.' });
      }
      customCommand = customCommand.trim().slice(0, 2000);

      const intervalOverride = interaction.options.getInteger('interval_minutes');
      const intervalMinutes = intervalOverride
        ? clampIntervalMinutes(intervalOverride, getDefaultIntervalMs(serviceKey))
        : clampIntervalMinutes(Math.round(getDefaultIntervalMs(serviceKey) / 60_000), getDefaultIntervalMs(serviceKey));
      const intervalMs = intervalMinutes * 60 * 1000;

      const startDelayMinutes = interaction.options.getInteger('start_after_minutes');
      const startAfterMs = startDelayMinutes ? startDelayMinutes * 60 * 1000 : 60 * 1000;

      const allowMentions = interaction.options.getBoolean('allow_mentions') || false;

      const job = await store.addJob(guildId, {
        channelId: channel.id,
        service: serviceKey,
        command: customCommand,
        intervalMs,
        allowMentions,
        startAfterMs,
      });

      try {
        await scheduler.startJob(interaction.client, guildId, job);
      } catch (err) {
        console.error('Failed to start autobump job immediately:', err);
      }

      const summary = `${service.name} bump every ${intervalMinutes}m in ${channel}`;
      return interaction.editReply({ content: `Autobump job #${job.id} created: ${summary}. First bump ${formatRelative(job.nextRunAt)}.` });
    }

    if (sub === 'remove') {
      await interaction.deferReply({ ephemeral: true });
      const id = interaction.options.getInteger('id', true);
      const removed = await store.removeJob(guildId, id);
      try { scheduler.stopJob(guildId, id); } catch (_) {}
      return interaction.editReply({ content: removed ? `Removed autobump job #${id}.` : `Autobump job #${id} not found.` });
    }

    if (sub === 'enable') {
      await interaction.deferReply({ ephemeral: true });
      const id = interaction.options.getInteger('id', true);
      const job = await store.setEnabled(guildId, id, true);
      if (!job) {
        return interaction.editReply({ content: `Autobump job #${id} not found.` });
      }
      try { await scheduler.startJob(interaction.client, guildId, job); } catch (_) {}
      return interaction.editReply({ content: `Autobump job #${id} enabled. Next bump ${formatRelative(job.nextRunAt)}.` });
    }

    if (sub === 'disable') {
      await interaction.deferReply({ ephemeral: true });
      const id = interaction.options.getInteger('id', true);
      const job = await store.setEnabled(guildId, id, false);
      if (!job) {
        return interaction.editReply({ content: `Autobump job #${id} not found.` });
      }
      try { scheduler.stopJob(guildId, id); } catch (_) {}
      return interaction.editReply({ content: `Autobump job #${id} disabled.` });
    }

    if (sub === 'list') {
      await interaction.deferReply({ ephemeral: true });
      const jobs = await store.listJobs(guildId);
      if (!jobs.length) {
        return interaction.editReply({ content: 'No autobump jobs configured yet.' });
      }
      const now = Date.now();
      const lines = jobs.map(job => {
        const service = getService(job.service);
        const status = job.enabled ? '🟢 ON' : '🔴 OFF';
        const intervalMinutes = Math.round((Number(job.intervalMs) || getDefaultIntervalMs(job.service)) / 60_000);
        const next = job.enabled ? formatRelative(job.nextRunAt) : 'paused';
        const last = job.lastRunAt ? `${formatDuration(now - job.lastRunAt)} ago` : 'never';
        const base = `#${job.id} ${status} • ${(service?.name || job.service)} • every ${intervalMinutes}m • <#${job.channelId}>`;
        const extras = [];
        extras.push(`next ${next}`);
        extras.push(`last ${last}`);
        if (job.lastError) extras.push(`⚠️ ${job.lastError}`);
        if (job.command && job.command !== getDefaultCommand(job.service)) {
          extras.push(`cmd: ${job.command.slice(0, 60)}`);
        }
        return `${base}\n    ${extras.join(' | ')}`;
      });
      const content = lines.join('\n');
      return interaction.editReply({ content: content.slice(0, 1900) });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};
