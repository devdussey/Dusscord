const { Events } = require('discord.js');
const messageLogStore = require('../utils/userMessageLogStore');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message?.guild) return;
      if (message.author?.bot) return;

      await messageLogStore.recordMessage(message.guild.id, message.author.id, message);
    } catch (err) {
      console.error('Failed to update judgement message log', err);
    }
  },
};
