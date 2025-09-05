const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
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

    // Install console.error relay to a Discord channel or owner DMs
  try {
    const relay = require('../utils/errorConsoleRelay');
    relay.install(client);
  } catch (e) {
    console.warn('Failed to install error console relay:', e?.message || e);
  }

    // Start auto-post scheduler for any saved repeat jobs
    try {
      const scheduler = require('../utils/autoPostScheduler');
      await scheduler.startAll(client);
    } catch (e) {
      console.warn('Failed to start auto-post scheduler:', e?.message || e);
    }
  },
};
