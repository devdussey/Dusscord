const {
  AuditLogEvent,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const store = require('./antiNukeStore');
const streamLogger = require('./streamLogger');
const streamLogStore = require('./streamLogStore');
const securityLogger = require('./securityLogger');
const securityEventsStore = require('./securityEventsStore');
const jailStore = require('./jailStore');

const FLAG_OPTIONS = [
  { value: 'enabled', label: 'Anti-nuke enabled', description: 'Master on/off switch', getter: cfg => cfg.enabled },
  { value: 'channelDelete', label: 'Monitor channel deletions', description: 'Track channel deletions per user', getter: cfg => cfg.detections.channelDelete.enabled },
  { value: 'roleDelete', label: 'Monitor role deletions', description: 'Track role deletions per user', getter: cfg => cfg.detections.roleDelete.enabled },
  { value: 'autoJail', label: 'Auto jail attackers', description: 'Automatically jail users who trip thresholds', getter: cfg => cfg.autoJail },
  { value: 'notifyOwners', label: 'Owner DM alerts', description: 'DM configured bot owners when triggered', getter: cfg => cfg.notifyOwners },
  { value: 'streamAlerts', label: 'Stream log alerts', description: 'Echo alerts via stream log security category', getter: cfg => cfg.streamAlerts },
  { value: 'ignoreBots', label: 'Ignore bot accounts', description: 'Skip bot users when counting actions', getter: cfg => cfg.ignoreBots },
];

const CHANNEL_PRESETS = [
  { threshold: 2, windowSec: 30 },
  { threshold: 3, windowSec: 60 },
  { threshold: 5, windowSec: 120 },
  { threshold: 10, windowSec: 300 },
];

const ROLE_PRESETS = [
  { threshold: 2, windowSec: 45 },
  { threshold: 3, windowSec: 90 },
  { threshold: 5, windowSec: 180 },
];

const ACTION_TYPES = {
  channelDelete: {
    label: 'Channel deletions',
    auditType: AuditLogEvent.ChannelDelete,
    category: 'channels',
    color: 0xff4d4d,
  },
  roleDelete: {
    label: 'Role deletions',
    auditType: AuditLogEvent.RoleDelete,
    category: 'roles',
    color: 0xff6b4d,
  },
};

const counters = new Map();
const cooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatDetection({ enabled, threshold, windowSec }) {
  if (!enabled) return '❌ Monitoring disabled';
  return `✅ Monitoring — ${threshold} action${threshold === 1 ? '' : 's'} in ${windowSec}s`;
}

function describeChannel(channel) {
  if (!channel) return 'Unknown channel';
  const type = typeof channel.type === 'number' ? channel.type : channel.type ?? 'unknown';
  let typeLabel = 'Unknown';
  switch (type) {
    case ChannelType.GuildText:
      typeLabel = 'Text';
      break;
    case ChannelType.GuildVoice:
      typeLabel = 'Voice';
      break;
    case ChannelType.GuildAnnouncement:
      typeLabel = 'Announcement';
      break;
    case ChannelType.GuildStageVoice:
      typeLabel = 'Stage';
      break;
    case ChannelType.GuildForum:
      typeLabel = 'Forum';
      break;
    default:
      typeLabel = typeof type === 'string' ? type : 'Other';
  }
  const name = channel.name ? `#${channel.name}` : 'Unnamed';
  return `${name} (${channel.id || 'unknown'})\nType: ${typeLabel}`;
}

function describeRole(role) {
  if (!role) return 'Unknown role';
  const name = role.name || 'Unnamed role';
  return `${name} (${role.id || 'unknown'})`;
}

function buildThresholdLabel(threshold, windowSec) {
  return `${threshold} in ${windowSec}s`;
}

function buildThresholdDescription(threshold, windowSec) {
  return `Trigger after ${threshold} action${threshold === 1 ? '' : 's'} within ${windowSec} second${windowSec === 1 ? '' : 's'}.`;
}

function mapPresetOptions(presets, current) {
  const options = presets.map(preset => ({
    label: buildThresholdLabel(preset.threshold, preset.windowSec),
    value: `${preset.threshold}|${preset.windowSec}`,
    description: buildThresholdDescription(preset.threshold, preset.windowSec),
    default: preset.threshold === current.threshold && preset.windowSec === current.windowSec,
  }));
  const hasDefault = options.some(opt => opt.default);
  if (!hasDefault) {
    options.unshift({
      label: `Custom: ${buildThresholdLabel(current.threshold, current.windowSec)}`,
      value: `${current.threshold}|${current.windowSec}`,
      description: 'Current value outside presets',
      default: true,
    });
  }
  return options;
}

async function buildConfigEmbed(guild, config) {
  const embed = new EmbedBuilder()
    .setTitle('Anti-Nuke Configuration')
    .setDescription('Use the menus below to toggle protections and tune thresholds.')
    .setTimestamp(new Date());
  try {
    const { applyDefaultColour } = require('./guildColourStore');
    applyDefaultColour(embed, guild?.id);
  } catch (_) {}

  embed.addFields(
    { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
    { name: 'Owner DMs', value: config.notifyOwners ? '✅ On' : '❌ Off', inline: true },
    { name: 'Stream alerts', value: config.streamAlerts ? '✅ On' : '❌ Off', inline: true },
    { name: 'Channel deletions', value: formatDetection(config.detections.channelDelete), inline: false },
    { name: 'Role deletions', value: formatDetection(config.detections.roleDelete), inline: false },
    { name: 'Auto mitigation', value: config.autoJail ? '🛑 Auto jail enabled' : 'Manual response', inline: false },
    { name: 'Ignore bots', value: config.ignoreBots ? '✅ Bot executors ignored' : '⚠️ Bots can trigger anti-nuke', inline: false },
  );

  const warnings = [];
  const me = guild?.members?.me;
  if (!config.enabled) warnings.push('• Anti-nuke is currently disabled. Enable "Anti-nuke enabled" to activate protections.');
  if (config.autoJail) {
    const jailConfig = await jailStore.getConfig(guild.id);
    if (!jailConfig?.jailRoleId) warnings.push('• Auto jail is on, but no jail role is configured. Set one via `/jail config`.');
    if (!me?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) warnings.push('• Auto jail is on, but the bot lacks **Manage Roles**.');
  }
  const canViewAudit = me?.permissions?.has(PermissionsBitField.Flags.ViewAuditLog);
  if (!canViewAudit) warnings.push('• Bot is missing **View Audit Log** permission. Executor detection may fail.');
  if (config.streamAlerts) {
    const streamEnabled = await streamLogStore.getEnabled(guild.id, 'security');
    const streamChannel = await streamLogStore.getChannelForCategory(guild.id, 'security');
    if (!streamEnabled || !streamChannel) warnings.push('• Stream alerts are on, but the `security` stream category or channel is not configured. Use `/logsecurityset` and `/logsecuritymode`.');
  }
  if (!config.notifyOwners) warnings.push('• Owner DM alerts are disabled. Consider enabling them for escalations.');

  if (warnings.length) {
    embed.addFields({ name: 'Warnings', value: warnings.join('\n'), inline: false });
  }

  return embed;
}

function buildFlagMenu(config) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId('antinuke:flags')
    .setPlaceholder('Toggle protections')
    .setMinValues(0)
    .setMaxValues(FLAG_OPTIONS.length)
    .addOptions(FLAG_OPTIONS.map(opt => ({
      label: opt.label,
      value: opt.value,
      description: opt.description,
      default: !!opt.getter(config),
    })));
  return menu;
}

function buildThresholdMenu(config, type) {
  const current = config.detections[type];
  const presets = type === 'channelDelete' ? CHANNEL_PRESETS : ROLE_PRESETS;
  const options = mapPresetOptions(presets, current);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`antinuke:threshold:${type}`)
    .setPlaceholder(type === 'channelDelete' ? 'Channel deletion threshold' : 'Role deletion threshold')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(options);
  return menu;
}

function buildConfigComponents(config) {
  const rows = [];
  rows.push(new ActionRowBuilder().addComponents(buildFlagMenu(config)));
  rows.push(new ActionRowBuilder().addComponents(buildThresholdMenu(config, 'channelDelete')));
  rows.push(new ActionRowBuilder().addComponents(buildThresholdMenu(config, 'roleDelete')));
  return rows;
}

function parseThresholdValue(value) {
  const parts = String(value || '').split('|');
  if (parts.length !== 2) return null;
  const threshold = Number.parseInt(parts[0], 10);
  const windowSec = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(threshold) || !Number.isFinite(windowSec)) return null;
  return { threshold, windowSec };
}

async function updateFlags(guildId, selectedValues) {
  const selected = new Set(selectedValues || []);
  return store.updateConfig(guildId, cfg => {
    cfg.enabled = selected.has('enabled');
    cfg.detections.channelDelete.enabled = selected.has('channelDelete');
    cfg.detections.roleDelete.enabled = selected.has('roleDelete');
    cfg.autoJail = selected.has('autoJail');
    cfg.notifyOwners = selected.has('notifyOwners');
    cfg.streamAlerts = selected.has('streamAlerts');
    cfg.ignoreBots = selected.has('ignoreBots');
    return cfg;
  });
}

async function updateThreshold(guildId, type, value) {
  const parsed = parseThresholdValue(value);
  if (!parsed) throw new Error('Invalid threshold value');
  return store.updateConfig(guildId, cfg => {
    const det = cfg.detections[type];
    if (!det) throw new Error('Unknown detection type');
    det.threshold = parsed.threshold;
    det.windowSec = parsed.windowSec;
    return cfg;
  });
}

function getCounterKey(guildId, userId, type) {
  return `${guildId}:${userId}:${type}`;
}

function pruneCounters(key, windowMs, now) {
  const list = counters.get(key) || [];
  const filtered = list.filter(ts => now - ts <= windowMs);
  counters.set(key, filtered);
  return filtered;
}

async function fetchExecutor(guild, type, targetId) {
  const info = ACTION_TYPES[type];
  if (!info) return null;
  const me = guild.members.me;
  if (!me?.permissions?.has(PermissionsBitField.Flags.ViewAuditLog)) return null;
  let logs;
  try {
    logs = await guild.fetchAuditLogs({ type: info.auditType, limit: 5 });
  } catch (err) {
    console.error('Failed to fetch audit logs for anti-nuke:', err);
    return null;
  }
  const now = Date.now();
  const entry = logs.entries.find(e => {
    if (!e) return false;
    if (e.targetId && targetId) {
      if (e.targetId !== targetId) return false;
    } else if (e.target?.id && targetId) {
      if (e.target.id !== targetId) return false;
    }
    return now - (e.createdTimestamp || now) < 15000;
  });
  if (!entry) return null;
  const executor = entry.executor || entry.user;
  if (!executor) return null;
  let member = guild.members.cache.get(executor.id);
  if (!member) {
    try { member = await guild.members.fetch(executor.id); } catch (_) {}
  }
  return { user: executor, member, entry };
}

async function attemptAutoJail(guild, executor, contextText) {
  const config = await jailStore.getConfig(guild.id);
  if (!config?.jailRoleId) return { attempted: true, success: false, message: 'Jail role not configured' };

  const me = guild.members.me;
  if (!me?.permissions?.has(PermissionsBitField.Flags.ManageRoles)) return { attempted: true, success: false, message: 'Bot missing Manage Roles' };
  if (!executor) return { attempted: true, success: false, message: 'Executor not found' };
  if (executor.id === guild.ownerId) return { attempted: true, success: false, message: 'Cannot jail guild owner' };

  let member = guild.members.cache.get(executor.id);
  if (!member) {
    try { member = await guild.members.fetch(executor.id); } catch (_) {}
  }
  if (!member) return { attempted: true, success: false, message: 'Executor not in guild' };

  let jailRole = guild.roles.cache.get(config.jailRoleId);
  if (!jailRole) {
    try { jailRole = await guild.roles.fetch(config.jailRoleId); } catch (_) {}
  }
  if (!jailRole) return { attempted: true, success: false, message: 'Jail role missing' };
  if (jailRole.managed) return { attempted: true, success: false, message: 'Jail role is managed' };

  const meTop = me.roles.highest;
  if (!meTop || meTop.comparePositionTo(jailRole) <= 0) return { attempted: true, success: false, message: 'Jail role above bot hierarchy' };
  if (meTop.comparePositionTo(member.roles.highest) <= 0) return { attempted: true, success: false, message: 'Target role hierarchy above bot' };

  const removed = [];
  for (const role of member.roles.cache.values()) {
    if (!role) continue;
    if (role.id === guild.id) continue; // everyone
    if (role.id === jailRole.id) continue;
    if (role.managed) continue;
    if (meTop.comparePositionTo(role) <= 0) continue;
    try {
      await member.roles.remove(role, 'Anti-nuke auto jail');
      removed.push(role.id);
    } catch (err) {
      console.error('Failed to remove role during auto jail:', err);
    }
  }

  try {
    await member.roles.add(jailRole, 'Anti-nuke auto jail');
  } catch (err) {
    console.error('Failed to add jail role during auto jail:', err);
    return { attempted: true, success: false, message: 'Failed to add jail role' };
  }

  try {
    await jailStore.setJailed(guild.id, member.id, {
      roles: removed,
      reason: contextText,
      at: Date.now(),
      until: null,
    });
  } catch (err) {
    console.error('Failed to record auto jail:', err);
  }

  return { attempted: true, success: true, message: `Jailed and removed ${removed.length} role(s)` };
}

async function sendAlerts(guild, embed, { notifyOwners, streamAlerts }) {
  const clones = [];
  clones.push(EmbedBuilder.from(embed));
  clones.push(EmbedBuilder.from(embed));

  if (streamAlerts) {
    try {
      await streamLogger.send(guild, 'security', clones[0]);
    } catch (err) {
      console.error('Failed to send stream alert for anti-nuke:', err);
    }
  }

  try {
    await securityLogger.sendSecurityAlert(guild, clones[1], { notifyOwners });
  } catch (err) {
    console.error('Failed to send security log alert for anti-nuke:', err);
  }
}

async function recordEvent(guildId, user, type, detection) {
  try {
    await securityEventsStore.addEvent({
      type: 'antinuke',
      guildId,
      userId: user?.id || null,
      tag: user?.tag || user?.username || 'Unknown',
      action: type,
      reason: `Threshold ${detection.threshold}/${detection.windowSec}s`,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Failed to record anti-nuke event:', err);
  }
}

async function handleDestructiveAction(guild, type, target) {
  try {
    if (!guild) return;
    const config = await store.getConfig(guild.id);
    if (!config.enabled) return;
    const detection = config.detections[type];
    if (!detection?.enabled) return;

    const info = ACTION_TYPES[type];
    if (!info) return;

    const executorInfo = await fetchExecutor(guild, type, target?.id || target?.targetId || null);
    if (!executorInfo) return;
    const { user, entry } = executorInfo;

    if (config.ignoreBots && user?.bot) return;
    if (user?.id === guild.client?.user?.id) return;

    const key = getCounterKey(guild.id, user.id, type);
    const now = Date.now();
    const windowMs = detection.windowSec * 1000;
    const recent = pruneCounters(key, windowMs, now);
    recent.push(now);
    counters.set(key, recent);

    const lastTrigger = cooldowns.get(key) || 0;
    if (recent.length < detection.threshold) return;
    if (now - lastTrigger < COOLDOWN_MS) return;

    cooldowns.set(key, now);
    counters.set(key, []);

    const embed = new EmbedBuilder()
      .setTitle('⚠️ Anti-Nuke Triggered')
      .setColor(info.color)
      .setTimestamp(new Date())
      .addFields(
        { name: 'Executor', value: user ? `${user.tag} (${user.id})` : 'Unknown', inline: false },
        { name: 'Action', value: `${info.label} — threshold ${detection.threshold} in ${detection.windowSec}s`, inline: false },
        { name: 'Count in window', value: String(recent.length), inline: true },
      );

    if (type === 'channelDelete') {
      embed.addFields({ name: 'Latest target', value: describeChannel(target), inline: false });
    } else if (type === 'roleDelete') {
      embed.addFields({ name: 'Latest target', value: describeRole(target), inline: false });
    }

    if (entry?.reason) {
      embed.addFields({ name: 'Audit log reason', value: entry.reason.slice(0, 512), inline: false });
    }

    const mitigationNotes = [];
    if (config.autoJail) {
      const autoResult = await attemptAutoJail(guild, user, `${info.label} threshold exceeded (${detection.threshold}/${detection.windowSec}s)`);
      mitigationNotes.push(autoResult.success ? `✅ ${autoResult.message}` : `⚠️ Auto jail failed — ${autoResult.message}`);
    } else {
      mitigationNotes.push('Manual response required (auto jail disabled).');
    }
    mitigationNotes.push(config.notifyOwners ? 'Owner DM alerts enabled.' : 'Owner DM alerts disabled.');
    mitigationNotes.push(config.streamAlerts ? 'Stream alerts enabled.' : 'Stream alerts disabled.');

    embed.addFields({ name: 'Mitigation', value: mitigationNotes.join('\n'), inline: false });

    await recordEvent(guild.id, user, type, detection);
    await sendAlerts(guild, embed, { notifyOwners: config.notifyOwners, streamAlerts: config.streamAlerts });
  } catch (err) {
    console.error('Anti-nuke handler error:', err);
  }
}

async function buildConfigView(guild, config) {
  const cfg = config || await store.getConfig(guild.id);
  const embed = await buildConfigEmbed(guild, cfg);
  const components = buildConfigComponents(cfg);
  return { config: cfg, embed, components };
}

module.exports = {
  buildConfigView,
  updateFlags,
  updateThreshold,
  handleDestructiveAction,
  CHANNEL_PRESETS,
  ROLE_PRESETS,
};
