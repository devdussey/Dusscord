const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const logStore = require('./securityLogStore');
const eventsStore = require('./securityEventsStore');
const { parseOwnerIds } = require('./ownerIds');

async function sendToChannelOrOwners(interaction, embed) {
  const guild = interaction.guild;
  const client = interaction.client;
  // Prefer per-guild configured channel, fallback to env
  let channelId = null;
  if (guild) channelId = await logStore.get(guild.id);
  if (!channelId) channelId = process.env.SECURITY_LOG_CHANNEL_ID;
  const mode = guild ? await logStore.getMode(guild.id) : 'channel';
  if (guild && (await logStore.getEnabled(guild.id)) === false) return false;

  let sent = false;
  const trySendChannel = async () => {
    if (!guild || !channelId) return false;
    const ch = guild.channels.cache.get(channelId) || (await guild.channels.fetch(channelId).catch(err => {
      console.error(`Failed to fetch security log channel ${channelId} in guild ${guild?.id}`, err);
      return null;
    }));
    if (!ch) {
      console.error(`Security log channel ${channelId} not found or inaccessible in guild ${guild?.id}`);
      return false;
    }
    if (ch.isTextBased?.()) {
      try {
        await ch.send({ embeds: [embed] });
        return true;
      } catch (err) {
        console.error(`Failed to send security log message to channel ${channelId} in guild ${guild?.id}`, err);
      }
    }
    return false;
  };
  const trySendOwners = async () => {
    const owners = parseOwnerIds();
    let ok = false;
    for (const id of owners) {
      try {
        const user = await client.users.fetch(id);
        await user.send({ embeds: [embed] });
        ok = true;
      } catch (err) {
        console.error(`Failed to notify owner ${id} about security event`, err);
      }
    }
    return ok;
  };

  if (mode === 'channel') {
    sent = await trySendChannel();
    if (!sent) sent = await trySendOwners(); // fallback
  } else if (mode === 'owners') {
    sent = await trySendOwners();
  } else { // both
    const a = await trySendChannel();
    const b = await trySendOwners();
    sent = a || b;
  }
  return sent;
}

function baseEmbed(interaction, title, color = 0xffaa00) {
  const guild = interaction.guild;
  const fields = [
    { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
  ];
  if (guild) fields.unshift({ name: 'Guild', value: `${guild.name} (${guild.id})`, inline: false });
  if (interaction.channel) fields.push({ name: 'Channel', value: `<#${interaction.channel.id}> (${interaction.channel.id})`, inline: false });
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp(new Date())
    .addFields(fields);
}

async function logPermissionDenied(interaction, action, reason, extraFields = []) {
  try {
    await eventsStore.addEvent({
      type: 'perm_denied',
      guildId: interaction.guildId || null,
      userId: interaction.user?.id || null,
      tag: interaction.user?.tag || null,
      action,
      reason,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Failed to record permission denied event', err);
  }
  const embed = baseEmbed(interaction, `Permission denied: ${action}`)
    .addFields(
      { name: 'Command', value: `/${interaction.commandName}`, inline: true },
      { name: 'Reason', value: reason, inline: true },
      ...extraFields,
    );
  await sendToChannelOrOwners(interaction, embed);
}

async function logHierarchyViolation(interaction, action, target, reason, extraFields = []) {
  try {
    await eventsStore.addEvent({
      type: 'hierarchy_block',
      guildId: interaction.guildId || null,
      userId: interaction.user?.id || null,
      tag: interaction.user?.tag || null,
      action,
      reason,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Failed to record hierarchy violation event', err);
  }
  const targetVal = target ? (target.user ? `${target.user.tag} (${target.user.id})` : `${target.tag || target.id} (${target.id || 'unknown'})`) : 'Unknown';
  const embed = baseEmbed(interaction, `Hierarchy blocked: ${action}`)
    .addFields(
      { name: 'Command', value: `/${interaction.commandName}`, inline: true },
      { name: 'Target', value: targetVal, inline: false },
      { name: 'Reason', value: reason, inline: false },
      ...extraFields,
    );
  await sendToChannelOrOwners(interaction, embed);
}

async function logMissingCommand(interaction) {
  try {
    await eventsStore.addEvent({
      type: 'missing_cmd',
      guildId: interaction.guildId || null,
      userId: interaction.user?.id || null,
      tag: interaction.user?.tag || null,
      action: 'missing_command',
      reason: interaction.commandName || 'unknown',
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Failed to record missing command event', err);
  }
  const embed = baseEmbed(interaction, 'Unknown or missing command', 0xff4444)
    .addFields(
      { name: 'Name', value: `/${interaction.commandName}`, inline: true },
      { name: 'Note', value: 'User invoked a command that is not loaded on this instance.', inline: false },
    );
  await sendToChannelOrOwners(interaction, embed);
}

module.exports = {
  logPermissionDenied,
  logHierarchyViolation,
  logMissingCommand,
};
