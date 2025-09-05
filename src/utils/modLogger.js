const { EmbedBuilder } = require('discord.js');
const store = require('./modLogStore');
const { parseOwnerIds } = require('./ownerIds');

async function send(interaction, embed) {
  const guild = interaction.guild;
  const client = interaction.client;
  if (!guild) return false;
  if (store.getEnabled(guild.id) === false) return false;
  const mode = store.getMode(guild.id) || 'channel';
  const channelId = store.get(guild.id) || process.env.MOD_LOG_CHANNEL_ID;

  const tryChannel = async () => {
    if (!channelId) return false;
    const ch = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (ch && ch.isTextBased?.()) {
      try { await ch.send({ embeds: [embed] }); return true; } catch (_) {}
    }
    return false;
  };
  const tryOwners = async () => {
    const owners = parseOwnerIds();
    let ok = false;
    for (const id of owners) {
      try { const u = await client.users.fetch(id); await u.send({ embeds: [embed] }); ok = true; } catch (_) {}
    }
    return ok;
  };

  if (mode === 'channel') {
    let s = await tryChannel();
    if (!s) s = await tryOwners();
    return s;
  } else if (mode === 'owners') {
    return await tryOwners();
  } else { // both
    const a = await tryChannel();
    const b = await tryOwners();
    return a || b;
  }
}

function baseEmbed(interaction, title, color = 0x5865f2) {
  const guild = interaction.guild;
  const fields = [
    { name: 'Moderator', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
  ];
  if (guild) fields.unshift({ name: 'Guild', value: `${guild.name} (${guild.id})`, inline: false });
  if (interaction.channel) fields.push({ name: 'Channel', value: `<#${interaction.channel.id}> (${interaction.channel.id})`, inline: false });
  return new EmbedBuilder().setTitle(title).setColor(color).setTimestamp(new Date()).addFields(fields);
}

async function log(interaction, title, extraFields = [], color) {
  const embed = baseEmbed(interaction, title, color);
  if (Array.isArray(extraFields) && extraFields.length) embed.addFields(extraFields);
  await send(interaction, embed);
}

module.exports = { log };

