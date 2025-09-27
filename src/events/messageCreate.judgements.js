const { Events } = require('discord.js');
const judgementStore = require('../utils/judgementStore');
const messageLogStore = require('../utils/userMessageLogStore');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message?.guild) return;
      if (message.author?.bot) return;

      await Promise.all([
        judgementStore.incrementMessage(message.guild.id, message.author.id),
        messageLogStore.recordMessage(message.guild.id, message.author.id, message),
      ]);
    } catch (err) {
      console.error('Failed to update judgement progress', err);
    }
  },
};
