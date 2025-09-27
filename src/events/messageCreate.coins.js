const { Events } = require('discord.js');
const coinStore = require('../utils/coinStore');
const { getMessageCoinReward } = require('../utils/economyConfig');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message?.guild) return;
      if (message.author?.bot) return;

      const reward = getMessageCoinReward();
      if (reward <= 0) return;

      await coinStore.addCoins(message.guild.id, message.author.id, reward);
    } catch (err) {
      console.error('Failed to award message coins', err);
    }
  },
};
