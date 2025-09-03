const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`${client.user.tag} is online and ready!`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);

    const isDev = process.env.NODE_ENV === 'development';
    const presenceName = isDev ? '[DEV] /botinfo • /help' : '/help';
    const status = isDev ? 'dnd' : 'online';

    try {
      client.user.setPresence({
        activities: [{ name: presenceName, type: ActivityType.Playing }],
        status,
      });
    } catch (e) {
      console.warn('Failed to set presence:', e?.message || e);
    }
  },
};

