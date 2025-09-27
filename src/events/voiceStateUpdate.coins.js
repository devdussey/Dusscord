const { Events } = require('discord.js');
const coinStore = require('../utils/coinStore');
const {
  getVoiceCoinRewardPerMinute,
  MS_PER_MINUTE,
} = require('../utils/economyConfig');

const sessions = new Map();

function getKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

async function awardCoins(guildId, userId, session, deltaMs) {
  if (!guildId || !userId || !session) return;
  session.remainderMs = (session.remainderMs || 0) + deltaMs;
  const rewardPerMinute = getVoiceCoinRewardPerMinute();
  if (rewardPerMinute <= 0) {
    session.remainderMs = 0;
    return;
  }
  const fullMinutes = Math.floor(session.remainderMs / MS_PER_MINUTE);
  if (fullMinutes <= 0) return;
  session.remainderMs -= fullMinutes * MS_PER_MINUTE;
  const coins = fullMinutes * rewardPerMinute;
  await coinStore.addCoins(guildId, userId, coins);
}

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    try {
      const guildId = newState?.guild?.id || oldState?.guild?.id;
      const userId = newState?.id || oldState?.id;
      if (!guildId || !userId) return;

      const key = getKey(guildId, userId);
      let session = sessions.get(key);
      if (!session) {
        session = { inVoice: false, lastTimestamp: 0, remainderMs: 0 };
        sessions.set(key, session);
      }

      const now = Date.now();
      const wasInVoice = Boolean(oldState?.channelId);
      const isInVoice = Boolean(newState?.channelId);

      if (session.inVoice && wasInVoice) {
        const delta = now - (session.lastTimestamp || now);
        if (delta > 0) {
          await awardCoins(guildId, userId, session, delta);
        }
        session.lastTimestamp = now;
      }

      if (!session.inVoice && isInVoice) {
        session.inVoice = true;
        session.lastTimestamp = now;
        session.remainderMs = session.remainderMs || 0;
        return;
      }

      if (session.inVoice && !isInVoice) {
        const delta = now - (session.lastTimestamp || now);
        if (delta > 0) {
          await awardCoins(guildId, userId, session, delta);
        }
        session.inVoice = false;
        session.lastTimestamp = now;
        session.remainderMs = 0;
        sessions.delete(key);
      }
    } catch (err) {
      console.error('Failed to award voice coins', err);
    }
  },
};
