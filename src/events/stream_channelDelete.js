const { Events } = require('discord.js');
const { send, baseEmbed } = require('../utils/streamLogger');
const antiNukeManager = require('../utils/antiNukeManager');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    try {
      const guild = channel?.guild;
      if (!guild) return;
      const embed = baseEmbed(guild, 'Channel Deleted', 0xff4d4d)
        .addFields({ name: 'Channel', value: channel?.name ? `#${channel.name} (${channel.id})` : String(channel?.id || 'unknown'), inline: true });
      await send(guild, 'channels', embed);
      try {
        await antiNukeManager.handleDestructiveAction(guild, 'channelDelete', channel);
      } catch (err) {
        console.error('Anti-nuke channel delete processing failed:', err);
      }
    } catch (_) {}
  },
};
