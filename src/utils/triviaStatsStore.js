const fs = require('fs');
const { ensureFileSync, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'trivia_stats.json';
const DEFAULT_STORE = { guilds: {} };

let cache = null;

function loadStore() {
  if (cache) return cache;
  try {
    const filePath = ensureFileSync(STORE_FILE, DEFAULT_STORE);
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw) {
      cache = { guilds: {} };
    } else {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        cache = { guilds: {} };
      } else {
        cache = parsed;
        if (!cache.guilds || typeof cache.guilds !== 'object') cache.guilds = {};
      }
    }
  } catch (err) {
    console.error('Failed to load trivia stats store:', err);
    cache = { guilds: {} };
  }
  return cache;
}

function saveStore() {
  const store = loadStore();
  const safe = store && typeof store === 'object' ? store : { guilds: {} };
  if (!safe.guilds || typeof safe.guilds !== 'object') safe.guilds = {};
  writeJsonSync(STORE_FILE, safe);
}

function getGuildEntry(guildId) {
  const store = loadStore();
  if (!store.guilds[guildId] || typeof store.guilds[guildId] !== 'object') {
    store.guilds[guildId] = { players: {}, history: [] };
  }
  const entry = store.guilds[guildId];
  if (!entry.players || typeof entry.players !== 'object') entry.players = {};
  if (!Array.isArray(entry.history)) entry.history = [];
  return entry;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function recordGame(guildId, summary) {
  if (!guildId || !summary || typeof summary !== 'object') return null;
  const entry = getGuildEntry(guildId);
  const now = Date.now();

  const historyEntry = {
    categoryId: summary.categoryId || null,
    categoryName: summary.categoryName || null,
    difficulty: summary.difficulty || null,
    questions: toNumber(summary.questionCount),
    finishedAt: now,
    endedEarly: Boolean(summary.endedEarly),
    players: Array.isArray(summary.players)
      ? summary.players.map(player => ({
        userId: player.userId,
        placement: player.placement ?? null,
        correctAnswers: toNumber(player.correctAnswers),
        roundsParticipated: toNumber(player.roundsParticipated),
        coinsAwarded: toNumber(player.coinsAwarded),
      }))
      : [],
  };

  entry.history.push(historyEntry);
  if (entry.history.length > 50) entry.history.splice(0, entry.history.length - 50);

  if (Array.isArray(summary.players)) {
    for (const player of summary.players) {
      const { userId } = player;
      if (!userId) continue;
      const stats = entry.players[userId] && typeof entry.players[userId] === 'object'
        ? entry.players[userId]
        : {
          gamesPlayed: 0,
          firstPlace: 0,
          secondPlace: 0,
          thirdPlace: 0,
          roundsParticipated: 0,
          correctAnswers: 0,
          coinsEarned: 0,
          bestScore: 0,
          lastPlayedAt: 0,
        };

      const participated = toNumber(player.roundsParticipated);
      const correct = toNumber(player.correctAnswers);
      const placement = Number.isInteger(player.placement) ? player.placement : null;

      if (participated <= 0 && correct <= 0) {
        // Skip tracking players that never actively participated in the round.
        continue;
      }

      stats.gamesPlayed += 1;
      stats.roundsParticipated += participated;
      stats.correctAnswers += correct;
      stats.coinsEarned += toNumber(player.coinsAwarded);
      if (correct > stats.bestScore) stats.bestScore = correct;
      stats.lastPlayedAt = now;

      if (placement === 1) stats.firstPlace += 1;
      else if (placement === 2) stats.secondPlace += 1;
      else if (placement === 3) stats.thirdPlace += 1;

      entry.players[userId] = stats;
    }
  }

  saveStore();
  return historyEntry;
}

function getLeaderboard(guildId) {
  if (!guildId) return [];
  const entry = getGuildEntry(guildId);
  const players = Object.entries(entry.players)
    .map(([userId, stats]) => ({
      userId,
      gamesPlayed: toNumber(stats.gamesPlayed),
      firstPlace: toNumber(stats.firstPlace),
      secondPlace: toNumber(stats.secondPlace),
      thirdPlace: toNumber(stats.thirdPlace),
      roundsParticipated: toNumber(stats.roundsParticipated),
      correctAnswers: toNumber(stats.correctAnswers),
      coinsEarned: toNumber(stats.coinsEarned),
      bestScore: toNumber(stats.bestScore),
      lastPlayedAt: toNumber(stats.lastPlayedAt),
    }))
    .sort((a, b) => {
      if (b.firstPlace !== a.firstPlace) return b.firstPlace - a.firstPlace;
      if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return b.lastPlayedAt - a.lastPlayedAt;
    });
  return players;
}

function getRecentGames(guildId, limit = 5) {
  if (!guildId) return [];
  const entry = getGuildEntry(guildId);
  const games = Array.isArray(entry.history) ? entry.history.slice().reverse() : [];
  return games.slice(0, Math.max(0, limit));
}

function resetStatsCache() {
  cache = null;
}

module.exports = {
  recordGame,
  getLeaderboard,
  getRecentGames,
  resetStatsCache,
};
