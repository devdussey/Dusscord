const { Events } = require('discord.js');
const bagStore = require('../utils/messageTokenStore');

const BAG_LABEL = 'Smite';

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    try {
      if (!message?.guild) return;
      if (message.author?.bot) return;

      const result = await bagStore.incrementMessage(message.guild.id, message.author.id);
      if (!result || !result.awarded) return;

      const totalBags = result.tokens;
      const awardedBags = result.awarded;
      const pluralAward = awardedBags === 1 ? '' : 's';
      const pluralTotal = totalBags === 1 ? '' : 's';
      const nextIn = result.messagesUntilNext || bagStore.AWARD_THRESHOLD;
      const base = `You just earned ${awardedBags} ${BAG_LABEL}${pluralAward} in ${message.guild.name}!`;
      const totalLine = `You now have ${totalBags} ${BAG_LABEL}${pluralTotal}.`;
      const nextLine = `Next Smite in ${nextIn} message${nextIn === 1 ? '' : 's'}.`;
      const content = `${base} ${totalLine} ${nextLine}`.slice(0, 1900);

      try {
        await message.author.send({ content });
      } catch (_) {
        try {
          await message.reply({ content, allowedMentions: { repliedUser: false } });
        } catch (_) {
          // ignore if we cannot notify the user
        }
      }
    } catch (err) {
      console.error('Failed to process Smite increment', err);
    }
  },
};
