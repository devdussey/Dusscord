const { EmbedBuilder } = require('discord.js');
const store = require('./streamLogStore');

const CATEGORY_LABELS = {
  messages: 'Messages',
  invites: 'Invites',
  reactions: 'Reactions',
  roles: 'Roles',
  users: 'Users',
  server: 'Server',
  channels: 'Channels',
  bot: 'Bot',
  verification: 'Verification',
};

async function send(guild, category, embed) {
  try {
    if (!guild) return false;
    const enabled = await store.getEnabled(guild.id, category);
    if (!enabled) return false;
    const channelId = await store.getChannel(guild.id);
    if (!channelId) return false;
    const ch = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!ch || !ch.isTextBased?.()) return false;
    try {
      await ch.send({ embeds: [embed] });
      return true;
    } catch (_) {
      return false;
    }
  } catch (err) {
    console.error('streamLogger.send error:', err);
    return false;
  }
}

function baseEmbed(guild, title, color = 0x2b2d31) {
  const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp(new Date());
  try {
    const { applyDefaultColour } = require('./guildColourStore');
    applyDefaultColour(embed, guild?.id);
  } catch (_) {}
  if (guild) embed.addFields({ name: 'Guild', value: `${guild.name} (${guild.id})`, inline: false });
  return embed;
}

module.exports = { CATEGORY_LABELS, send, baseEmbed };

