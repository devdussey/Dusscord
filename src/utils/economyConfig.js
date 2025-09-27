const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

function getNumberEnv(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw === 'undefined') return defaultValue;
  const num = Number(raw);
  if (!Number.isFinite(num)) return defaultValue;
  return num;
}

function clampNonNegative(num, fallback = 0) {
  if (!Number.isFinite(num)) return fallback;
  return num < 0 ? 0 : num;
}

function getBaseCoins() {
  return clampNonNegative(getNumberEnv('COIN_BASE_AMOUNT', 50), 50);
}

function getMessageCoinReward() {
  return clampNonNegative(getNumberEnv('COIN_MESSAGE_REWARD', 1));
}

function getVoiceCoinRewardPerMinute() {
  return clampNonNegative(getNumberEnv('COIN_VOICE_REWARD_PER_MINUTE', 2));
}

function getSmiteCost() {
  return clampNonNegative(getNumberEnv('COIN_SMITE_COST', 200));
}

function getJudgementCost() {
  return clampNonNegative(getNumberEnv('COIN_JUDGEMENT_COST', 500));
}

function getRaceEntryFee() {
  return clampNonNegative(getNumberEnv('COIN_RACE_ENTRY_FEE', 5));
}

function getRaceRewards() {
  return {
    first: clampNonNegative(getNumberEnv('COIN_RACE_REWARD_FIRST', 15)),
    second: clampNonNegative(getNumberEnv('COIN_RACE_REWARD_SECOND', 10)),
    third: clampNonNegative(getNumberEnv('COIN_RACE_REWARD_THIRD', 5)),
  };
}

function getPrayReward() {
  return clampNonNegative(getNumberEnv('COIN_PRAY_REWARD', 25));
}

function getPrayCooldownMs() {
  const raw = getNumberEnv('COIN_PRAY_COOLDOWN_MS', MS_PER_DAY);
  return clampNonNegative(raw, MS_PER_DAY);
}

module.exports = {
  getBaseCoins,
  getMessageCoinReward,
  getVoiceCoinRewardPerMinute,
  getSmiteCost,
  getJudgementCost,
  getRaceEntryFee,
  getRaceRewards,
  getPrayReward,
  getPrayCooldownMs,
  MS_PER_MINUTE,
  MS_PER_DAY,
};
