const { EmbedBuilder, escapeMarkdown } = require('discord.js');
const coinStore = require('./coinStore');
const triviaData = require('./triviaData');
const triviaStatsStore = require('./triviaStatsStore');

const ROUND_DURATION_MS = 6_000;
const DEFAULT_QUESTION_COUNT = 10;
const BETWEEN_QUESTION_DELAY_MS = 1_500;

const activeGames = new Map();

function getKey(guildId, channelId) {
  return `${guildId}:${channelId}`;
}

function formatPlayerName(profile, userId) {
  if (profile) {
    const name = profile.displayName || profile.globalName || profile.username;
    if (name) return escapeMarkdown(name);
  }
  return `<@${userId}>`;
}

function ensurePlayer(game, userId, profile = null) {
  let stats = game.players.get(userId);
  if (!stats) {
    stats = {
      userId,
      roundsParticipated: 0,
      correctAnswers: 0,
      firstCorrectAt: null,
      lastCorrectAt: null,
      profile: profile || null,
      coinsAwarded: 0,
      placement: null,
    };
    game.players.set(userId, stats);
  }
  if (profile) {
    stats.profile = {
      username: profile.username || stats.profile?.username || null,
      displayName: profile.displayName || stats.profile?.displayName || null,
      globalName: profile.globalName || stats.profile?.globalName || null,
    };
  }
  return stats;
}

function parseAnswer(content) {
  if (!content) return null;
  const trimmed = content.trim().toUpperCase();
  if (!trimmed) return null;
  const match = /^([ABCD])\b/.exec(trimmed);
  return match ? match[1] : null;
}

function formatChoices(question) {
  const lines = [question.prompt, ''];
  for (const letter of ['A', 'B', 'C', 'D']) {
    const value = question.choices[letter];
    if (!value) continue;
    lines.push(`**${letter})** ${value}`);
  }
  lines.push('');
  lines.push('_Answer with A, B, C, or D._');
  return lines.join('\n');
}

function formatScoreboard(game, limit = 5) {
  const players = Array.from(game.players.values())
    .filter(player => player.correctAnswers > 0)
    .sort((a, b) => {
      if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
      if (a.firstCorrectAt && b.firstCorrectAt) return a.firstCorrectAt - b.firstCorrectAt;
      if (a.firstCorrectAt) return -1;
      if (b.firstCorrectAt) return 1;
      return a.userId.localeCompare(b.userId);
    });

  if (!players.length) return null;

  const lines = players.slice(0, Math.max(1, limit)).map((player, index) => {
    const accuracy = player.roundsParticipated > 0
      ? Math.round((player.correctAnswers / player.roundsParticipated) * 100)
      : 0;
    const name = formatPlayerName(player.profile, player.userId);
    const accuracyText = player.roundsParticipated > 0 ? ` (${accuracy}% accuracy)` : '';
    return `${index + 1}. ${name} — ${player.correctAnswers} correct${accuracyText}`;
  });

  return lines.join('\n');
}

function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function finishGame(game) {
  const sortedPlayers = Array.from(game.players.values()).sort((a, b) => {
    if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
    if (a.firstCorrectAt && b.firstCorrectAt) return a.firstCorrectAt - b.firstCorrectAt;
    if (a.firstCorrectAt) return -1;
    if (b.firstCorrectAt) return 1;
    return a.userId.localeCompare(b.userId);
  });

  const hasRounds = game.roundsPlayed > 0;

  if (!hasRounds) {
    await game.channel.send({
      content: game.stopReason === 'error'
        ? '⚠️ Trivia game ended unexpectedly before any questions were asked.'
        : '⏹️ Trivia game ended before any questions were asked.',
    }).catch(() => {});
    return;
  }

  const topScoreEntry = sortedPlayers.find(player => player.correctAnswers > 0);
  const topScore = topScoreEntry ? topScoreEntry.correctAnswers : 0;
  const secondScoreEntry = sortedPlayers.find(player => player.correctAnswers > 0 && player.correctAnswers < topScore);
  const secondScore = secondScoreEntry ? secondScoreEntry.correctAnswers : 0;

  let placementsAssigned = 0;
  let lastScore = null;
  for (let i = 0; i < sortedPlayers.length; i += 1) {
    const stats = sortedPlayers[i];
    if (stats.correctAnswers <= 0) {
      stats.placement = null;
      continue;
    }
    if (lastScore === null || stats.correctAnswers !== lastScore) {
      placementsAssigned = i + 1;
      lastScore = stats.correctAnswers;
    }
    stats.placement = placementsAssigned;
  }

  const winners = topScore > 0
    ? sortedPlayers.filter(player => player.correctAnswers === topScore)
    : [];
  const runnersUp = topScore > 0 && secondScore > 0
    ? sortedPlayers.filter(player => player.correctAnswers === secondScore)
    : [];

  for (const player of winners) {
    try {
      await coinStore.addCoins(game.guildId, player.userId, 20);
      player.coinsAwarded += 20;
    } catch (err) {
      console.error('Failed to award trivia winner coins:', err);
    }
  }

  for (const player of runnersUp) {
    try {
      await coinStore.addCoins(game.guildId, player.userId, 10);
      player.coinsAwarded += 10;
      if (player.placement && player.placement > 2) {
        player.placement = 2;
      }
    } catch (err) {
      console.error('Failed to award trivia runner-up coins:', err);
    }
  }

  const scoreboardFull = formatScoreboard(game, sortedPlayers.length);
  const title = game.stopReason === 'error'
    ? '⚠️ Trivia ended due to an error.'
    : game.isStopped && game.roundsPlayed < game.questionCount
      ? '⏹️ Trivia game ended early.'
      : '🏁 Trivia finished!';

  const rewardLines = [];
  if (winners.length) {
    const winnerNames = winners.map(player => formatPlayerName(player.profile, player.userId));
    rewardLines.push(`🥇 ${winnerNames.join(', ')} +20 coins`);
  }
  if (runnersUp.length) {
    const runnerNames = runnersUp.map(player => formatPlayerName(player.profile, player.userId));
    rewardLines.push(`🥈 ${runnerNames.join(', ')} +10 coins`);
  }
  if (!rewardLines.length && topScore <= 0) {
    rewardLines.push('No coins awarded — nobody answered a question correctly.');
  }

  const summaryLines = [
    title,
    `Category: **${game.categoryName}** (${game.difficultyLabel})`,
    `Questions played: ${game.roundsPlayed} / ${game.questionCount}`,
  ];
  if (rewardLines.length) {
    summaryLines.push('');
    summaryLines.push(...rewardLines);
  }
  if (scoreboardFull) {
    summaryLines.push('');
    summaryLines.push('📊 **Final Standings**');
    summaryLines.push(scoreboardFull);
  }

  await game.channel.send({ content: summaryLines.join('\n') }).catch(() => {});

  const statsPayload = sortedPlayers
    .filter(player => player.roundsParticipated > 0 || player.correctAnswers > 0)
    .map(player => ({
      userId: player.userId,
      roundsParticipated: player.roundsParticipated,
      correctAnswers: player.correctAnswers,
      placement: player.placement,
      coinsAwarded: player.coinsAwarded,
    }));

  triviaStatsStore.recordGame(game.guildId, {
    categoryId: game.categoryId,
    categoryName: game.categoryName,
    difficulty: game.difficulty,
    questionCount: game.roundsPlayed,
    endedEarly: game.isStopped && game.roundsPlayed < game.questionCount,
    players: statsPayload,
  });
}

async function askQuestion(game, question, index) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`Question ${index + 1} of ${game.questionCount}`)
    .setDescription(formatChoices(question));

  await game.channel.send({ embeds: [embed] }).catch(() => {});

  const responses = new Map();

  const collector = game.channel.createMessageCollector({
    time: ROUND_DURATION_MS,
    filter: message => {
      if (message.author.bot) return false;
      if (message.channelId !== game.channelId) return false;
      return true;
    },
  });

  game.currentCollector = collector;

  collector.on('collect', message => {
    if (game.isStopped) {
      try { collector.stop('game-stopped'); } catch (_) {}
      return;
    }
    if (responses.has(message.author.id)) return;
    const choice = parseAnswer(message.content);
    if (!choice) return;

    const profile = {
      username: message.author.username,
      displayName: message.member?.displayName || null,
      globalName: message.author.globalName || null,
    };

    const stats = ensurePlayer(game, message.author.id, profile);
    stats.roundsParticipated += 1;

    responses.set(message.author.id, {
      choice,
      timestamp: message.createdTimestamp || Date.now(),
      profile,
    });
  });

  await new Promise(resolve => {
    collector.on('end', () => resolve());
  });

  game.currentCollector = null;

  if (game.isStopped) return;

  game.roundsPlayed += 1;

  const correctChoice = question.answer;
  const correctResponses = [];

  for (const [userId, response] of responses.entries()) {
    if (response.choice !== correctChoice) continue;
    const stats = ensurePlayer(game, userId, response.profile);
    stats.correctAnswers += 1;
    stats.lastCorrectAt = response.timestamp;
    if (!stats.firstCorrectAt) stats.firstCorrectAt = response.timestamp;
    correctResponses.push({
      userId,
      profile: response.profile,
      timestamp: response.timestamp,
    });
  }

  correctResponses.sort((a, b) => a.timestamp - b.timestamp);

  const answerText = question.choices[correctChoice];
  const scoreboardText = formatScoreboard(game);

  const resultLines = [
    `🧠 **Answer:** ${correctChoice}) ${answerText}`,
  ];

  if (correctResponses.length) {
    const winners = correctResponses.map(entry => formatPlayerName(entry.profile, entry.userId));
    resultLines.push(`✅ ${winners.join(', ')} ${winners.length === 1 ? 'gets' : 'get'} a point!`);
  } else {
    resultLines.push('❌ Nobody answered correctly this round.');
  }

  if (scoreboardText) {
    resultLines.push('');
    resultLines.push('📊 **Standings**');
    resultLines.push(scoreboardText);
  }

  await game.channel.send({ content: resultLines.join('\n') }).catch(() => {});
}

async function runTriviaGame(game) {
  const introLines = [
    '🎯 **Trivia starting!**',
    `Category: **${game.categoryName}**`,
    `Difficulty: **${game.difficultyLabel}**`,
    `Questions: ${game.questionCount}`,
    `Host: <@${game.hostId}>`,
    '',
    'Answer with **A**, **B**, **C**, or **D** within 6 seconds to earn points.',
  ];

  await game.channel.send({ content: introLines.join('\n') }).catch(() => {});

  try {
    for (let index = 0; index < game.questions.length; index += 1) {
      if (game.isStopped) break;
      // eslint-disable-next-line no-await-in-loop
      await askQuestion(game, game.questions[index], index);
      if (game.isStopped) break;
      if (index < game.questions.length - 1) {
        // eslint-disable-next-line no-await-in-loop
        await wait(BETWEEN_QUESTION_DELAY_MS);
      }
    }
  } catch (err) {
    console.error('Trivia game encountered an unexpected error:', err);
    game.stopReason = 'error';
    game.isStopped = true;
  }

  await finishGame(game);
}

async function startTriviaGame(interaction, options) {
  const { categoryId, difficulty, questionCount } = options || {};
  const difficultyKey = triviaData.normaliseDifficultyKey(difficulty);
  if (!difficultyKey) {
    return { ok: false, error: 'Invalid difficulty selected.' };
  }

  const category = triviaData.getCategory(categoryId);
  if (!category) {
    return { ok: false, error: 'That category could not be found.' };
  }

  const pool = category.difficulties[difficultyKey];
  if (!pool || !pool.length) {
    return { ok: false, error: 'There are no questions available for that difficulty yet.' };
  }

  const requested = Number.isInteger(questionCount) ? questionCount : DEFAULT_QUESTION_COUNT;
  const actualCount = Math.max(1, Math.min(pool.length, requested));
  const questions = triviaData.getRandomQuestions(categoryId, difficultyKey, actualCount);
  if (!questions.length) {
    return { ok: false, error: 'Failed to build the question list for this game.' };
  }

  const key = getKey(interaction.guildId, interaction.channelId);
  if (activeGames.has(key)) {
    const existing = activeGames.get(key);
    return {
      ok: false,
      error: `A trivia game hosted by <@${existing.hostId}> is already running in this channel.`,
    };
  }

  const channel = interaction.channel;
  if (!channel || typeof channel.send !== 'function') {
    return { ok: false, error: 'Unable to access the target channel.' };
  }

  const game = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    channel,
    hostId: interaction.user.id,
    categoryId: category.id,
    categoryName: category.name,
    difficulty: difficultyKey,
    difficultyLabel: triviaData.formatDifficultyName(difficultyKey),
    questionCount: questions.length,
    questions,
    players: new Map(),
    roundsPlayed: 0,
    isStopped: false,
    stopReason: null,
    currentCollector: null,
    startedAt: Date.now(),
  };

  game.stop = (reason) => {
    if (game.isStopped) return;
    game.isStopped = true;
    game.stopReason = reason || 'stopped';
    const collector = game.currentCollector;
    if (collector) {
      try { collector.stop('game-stopped'); } catch (_) {}
    }
  };

  activeGames.set(key, game);

  runTriviaGame(game).catch(err => {
    console.error('Failed to run trivia game:', err);
  }).finally(() => {
    activeGames.delete(key);
  });

  return { ok: true, game, questionCount: questions.length };
}

function stopTriviaGame(guildId, channelId, reason = 'cancelled') {
  const game = getActiveGame(guildId, channelId);
  if (!game) return false;
  game.stop(reason);
  return true;
}

function getActiveGame(guildId, channelId) {
  return activeGames.get(getKey(guildId, channelId)) || null;
}

module.exports = {
  startTriviaGame,
  stopTriviaGame,
  getActiveGame,
};
