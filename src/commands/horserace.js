const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  escapeMarkdown,
} = require('discord.js');
const { recordRace } = require('../utils/horseRaceStore');

const TRACK_SLOTS = 20;
const TICK_DELAY_MS = 1200;
const MAX_TICKS = 18;
const JOIN_WINDOW_MS = 60_000;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 8; // command issuer + up to 7 more
const NPC_HORSES = [
  'Blaze',
  'Comet',
  'Juniper',
  'Maverick',
  'Nebula',
  'Pepper',
  'Shadowfax',
  'Storm',
  'Thunder',
  'Willow',
];
const PLACE_EMOJIS = ['🥇', '🥈', '🥉'];

function formatNumber(num, fractionDigits = 0) {
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function renderTrack(position) {
  const slots = Math.max(4, TRACK_SLOTS);
  const finishIndex = slots - 1;
  const arr = Array(slots).fill('·');
  const clamped = Math.max(0, Math.min(position, finishIndex));
  arr[clamped] = '🐎';
  return `${arr.join('')}🏁`;
}

function renderRace(horses, finishOrder, { finished, tick, oddsMap }) {
  const header = finished
    ? '**🏁 Horse Race — Final Standings**'
    : tick > 0
      ? `**🏇 Horse Race — Turn ${tick}**`
      : '**🏇 Horse Race**';

  const lines = horses.map((horse, index) => {
    const lane = `\`${String(index + 1).padStart(2, '0')}\``;
    const track = renderTrack(horse.position);
    const nameRaw = horse.shortName || horse.name || `Horse ${index + 1}`;
    const safeName = escapeMarkdown(nameRaw).slice(0, 32);
    const label = horse.isPlayer ? `**${safeName}**` : safeName;
    const placementIndex = finishOrder.indexOf(horse);
    let suffix = '';
    if (placementIndex !== -1) {
      suffix = ` ${PLACE_EMOJIS[placementIndex] ?? `#${placementIndex + 1}`}`;
    } else if (horse.finished) {
      const orderIndex = finishOrder.length + 1;
      suffix = ` #${orderIndex}`;
    } else if (horse.isPlayer) {
      suffix = ' ⭐';
    }
    const odds = oddsMap?.get(horse.id);
    const oddsText = odds ? ` _(odds ${formatNumber(odds, 2)}x)_` : '';
    return `${lane} ${track} ${label}${suffix}${oddsText}`;
  });

  const footer = finished ? '_Race complete!_' : '_Cheer on your favourite horse!_';
  return `${header}\n\n${lines.join('\n')}\n\n${footer}`;
}

function renderBettingSummary(horses, betTotals, totalPool, oddsMap) {
  if (!horses.length) return '_No racers yet._';

  const headline = totalPool > 0
    ? `**Betting Pool — ${formatNumber(totalPool)} coins total**`
    : '**Betting Pool — No bets placed yet**';

  const lines = horses.map((horse, index) => {
    const horseTotal = betTotals.get(horse.id) || 0;
    const odds = oddsMap.get(horse.id) || 0;
    const nameRaw = horse.shortName || horse.name || `Horse ${index + 1}`;
    const safeName = escapeMarkdown(nameRaw).slice(0, 32);
    const betText = horseTotal > 0
      ? `${formatNumber(horseTotal)} coins`
      : 'No bets';
    const oddsText = odds ? `${formatNumber(odds, 2)}x` : '—';
    return `• \`${String(index + 1).padStart(2, '0')}\` ${safeName} — ${betText} _(odds ${oddsText})_`;
  });

  return `${headline}\n${lines.join('\n')}`;
}

function calculateBettingState(horses, bets) {
  const betTotals = new Map();
  let totalPool = 0;

  for (const bet of bets.values()) {
    if (!bet) continue;
    const amount = Number(bet.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const current = betTotals.get(bet.horseId) || 0;
    betTotals.set(bet.horseId, current + amount);
    totalPool += amount;
  }

  const oddsMap = new Map();
  const basePool = totalPool > 0 ? totalPool : horses.length * 120;

  for (const horse of horses) {
    const horseTotal = betTotals.get(horse.id) || 0;
    const remainingDistance = Math.max(0, (TRACK_SLOTS - 1) - horse.position);
    const progressFactor = (remainingDistance + 1) / TRACK_SLOTS; // 0-1 range
    const effectiveStake = horseTotal + 60;
    let multiplier = (basePool + horses.length * 90) / effectiveStake;
    multiplier *= 0.6 + progressFactor * 0.8;
    multiplier = Math.max(1.1, Math.min(multiplier, 25));
    oddsMap.set(horse.id, multiplier);
  }

  return { betTotals, totalPool, oddsMap };
}

function renderWaitingState(horses, joinDeadline, betsState) {
  const now = Date.now();
  const secondsLeft = Math.max(0, Math.ceil((joinDeadline - now) / 1000));
  const header = '**🏁 Horse Race Lobby**';
  const description = horses.length
    ? horses
      .map((horse, index) => {
        const nameRaw = horse.shortName || horse.name || `Horse ${index + 1}`;
        const safeName = escapeMarkdown(nameRaw).slice(0, 32);
        const label = horse.isPlayer ? `**${safeName}**` : safeName;
        return `\`${String(index + 1).padStart(2, '0')}\` ${label}`;
      })
      .join('\n')
    : '_No riders yet — invite some friends!_';

  const countdown = `_Race starts in ${secondsLeft}s. Up to seven other players may join._`;
  const betting = renderBettingSummary(horses, betsState.betTotals, betsState.totalPool, betsState.oddsMap);

  return `${header}\n\n${description}\n\n${countdown}\n\n${betting}`;
}

function buildComponents(stage, participantCount, joinButtonId, betButtonId) {
  const joinDisabled = stage !== 'waiting' || participantCount >= MAX_PLAYERS;
  const betDisabled = stage === 'finished';

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(joinButtonId)
      .setLabel('Join Race')
      .setStyle(ButtonStyle.Success)
      .setDisabled(joinDisabled),
    new ButtonBuilder()
      .setCustomId(betButtonId)
      .setLabel('Place Bet')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(betDisabled),
  );

  return [row];
}

function pickNpcNames(count, exclude = new Set()) {
  const pool = NPC_HORSES.filter(name => !exclude.has(name));
  const chosen = [];
  const used = new Set();
  while (chosen.length < count) {
    const candidates = pool.length ? pool : NPC_HORSES;
    const idx = Math.floor(Math.random() * candidates.length);
    const name = candidates[idx];
    if (used.has(name)) continue;
    used.add(name);
    chosen.push(name);
  }
  return chosen;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('horserace')
    .setDescription('Start a left-to-right horse race featuring your own steed.'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: 'Horse races can only be started inside a server.', ephemeral: true });
      return;
    }

    const raceId = `${interaction.id}-${Date.now()}`;
    const joinButtonId = `horserace-join-${raceId}`;
    const betButtonId = `horserace-bet-${raceId}`;

    const participants = new Map();
    const horses = [];
    const finishOrder = [];
    const bets = new Map();

    function registerParticipant(user) {
      if (participants.has(user.id)) {
        return participants.get(user.id);
      }
      const displayName = user.displayName || user.username || user.globalName || `Racer ${horses.length + 1}`;
      const horse = {
        id: user.id,
        userId: user.id,
        name: displayName,
        shortName: displayName,
        isPlayer: true,
        position: 0,
        finished: false,
        finishTick: Number.POSITIVE_INFINITY,
      };
      participants.set(user.id, horse);
      horses.push(horse);
      return horse;
    }

    function addNpcRacers(count, excludeNames = new Set()) {
      const names = pickNpcNames(count, excludeNames);
      for (const [idx, name] of names.entries()) {
        horses.push({
          id: `npc-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          name,
          shortName: name,
          isPlayer: false,
          position: 0,
          finished: false,
          finishTick: Number.POSITIVE_INFINITY,
        });
      }
    }

    registerParticipant({
      id: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.member?.displayName,
      globalName: interaction.user.globalName,
    });

    const joinDeadline = Date.now() + JOIN_WINDOW_MS;
    let stage = 'waiting';
    let currentTick = 0;
    let finalSummary = '';

    await interaction.deferReply();

    const buildAndSend = async () => {
      try {
        const betsState = calculateBettingState(horses, bets);
        let content;
        if (stage === 'waiting') {
          content = renderWaitingState(horses, joinDeadline, betsState);
        } else {
          const raceBody = renderRace(horses, finishOrder, {
            finished: stage === 'finished',
            tick: currentTick,
            oddsMap: betsState.oddsMap,
          });
          if (stage === 'finished' && finalSummary) {
            content = `${raceBody}\n\n${finalSummary}`;
          } else {
            const betSummary = renderBettingSummary(horses, betsState.betTotals, betsState.totalPool, betsState.oddsMap);
            content = `${raceBody}\n\n${betSummary}`;
          }
        }

        await interaction.editReply({
          content,
          components: buildComponents(stage, horses.length, joinButtonId, betButtonId),
          allowedMentions: { parse: [] },
        });
      } catch (err) {
        console.error('Failed to update horserace message:', err);
      }
    };

    await buildAndSend();

    const collector = (await interaction.fetchReply()).createMessageComponentCollector({
      time: JOIN_WINDOW_MS + (MAX_TICKS * TICK_DELAY_MS) + 120_000,
    });

    const joinInterval = setInterval(() => {
      if (stage !== 'waiting') return;
      if (Date.now() >= joinDeadline) return;
      buildAndSend();
    }, 5_000);

    collector.on('collect', async (componentInteraction) => {
      if (componentInteraction.customId === joinButtonId) {
        if (stage !== 'waiting') {
          await componentInteraction.reply({ content: 'The race has already started!', ephemeral: true });
          return;
        }
        if (horses.length >= MAX_PLAYERS) {
          await componentInteraction.reply({ content: 'The roster is full!', ephemeral: true });
          return;
        }
        if (participants.has(componentInteraction.user.id)) {
          await componentInteraction.reply({ content: 'You are already entered in this race.', ephemeral: true });
          return;
        }
        registerParticipant({
          id: componentInteraction.user.id,
          username: componentInteraction.user.username,
          displayName: componentInteraction.member?.displayName,
          globalName: componentInteraction.user.globalName,
        });
        await componentInteraction.reply({ content: 'You have joined the race! 🐎', ephemeral: true });
        await buildAndSend();
      } else if (componentInteraction.customId === betButtonId) {
        if (stage === 'finished') {
          await componentInteraction.reply({ content: 'Betting has closed. The race is over!', ephemeral: true });
          return;
        }

        const modalCustomId = `horserace-bet-modal-${raceId}-${componentInteraction.user.id}`;
        const modal = new ModalBuilder()
          .setTitle('Place a Bet')
          .setCustomId(modalCustomId)
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('horseNumber')
                .setLabel('Horse number (lane)')
                .setPlaceholder('Enter a number between 1 and ' + horses.length)
                .setRequired(true)
                .setStyle(TextInputStyle.Short),
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('betAmount')
                .setLabel('Bet amount (coins)')
                .setPlaceholder('Enter a positive number')
                .setRequired(true)
                .setStyle(TextInputStyle.Short),
            ),
          );

        try {
          await componentInteraction.showModal(modal);
          const submission = await componentInteraction.awaitModalSubmit({
            time: 60_000,
            filter: (i) => i.customId === modalCustomId && i.user.id === componentInteraction.user.id,
          });

          const horseNumberRaw = submission.fields.getTextInputValue('horseNumber');
          const betAmountRaw = submission.fields.getTextInputValue('betAmount');
          const horseNumber = Number.parseInt(horseNumberRaw, 10);
          const betAmount = Number.parseFloat(betAmountRaw);

          if (!Number.isInteger(horseNumber) || horseNumber < 1 || horseNumber > horses.length) {
            await submission.reply({ content: `Please enter a valid horse number between 1 and ${horses.length}.`, ephemeral: true });
            return;
          }
          if (!Number.isFinite(betAmount) || betAmount <= 0) {
            await submission.reply({ content: 'Bet amount must be a positive number.', ephemeral: true });
            return;
          }
          if (betAmount > 1_000_000) {
            await submission.reply({ content: 'That bet is a little too spicy — keep it under 1,000,000 coins.', ephemeral: true });
            return;
          }

          const targetHorse = horses[horseNumber - 1];
          bets.set(submission.user.id, { horseId: targetHorse.id, amount: betAmount });

          await submission.reply({
            content: `Bet placed on **${escapeMarkdown(targetHorse.shortName || targetHorse.name)}** for ${formatNumber(betAmount)} coins.`,
            ephemeral: true,
          });
          await buildAndSend();
        } catch (err) {
          if (err?.code === 'INTERACTION_COLLECTOR_ERROR') return;
          if (err?.message?.includes('Collector received no interactions')) return;
          console.error('Failed to process bet modal:', err);
        }
      }
    });

    collector.on('end', () => {
      clearInterval(joinInterval);
    });

    const waitForJoinPhase = async () => {
      while (Date.now() < joinDeadline && stage === 'waiting') {
        await wait(1_000);
      }
    };

    await waitForJoinPhase();
    stage = 'running';

    const playerNames = new Set(horses.filter(h => h.isPlayer).map(h => h.name));
    if (horses.length < MIN_PLAYERS) {
      addNpcRacers(MIN_PLAYERS - horses.length, playerNames);
    } else if (horses.length < MAX_PLAYERS) {
      const npcToAdd = Math.max(0, Math.min(2, MAX_PLAYERS - horses.length));
      if (npcToAdd > 0) {
        addNpcRacers(npcToAdd, playerNames);
      }
    }

    await buildAndSend();

    for (let tick = 1; tick <= MAX_TICKS; tick += 1) {
      currentTick = tick;
      let anyProgress = false;
      for (const horse of horses) {
        if (horse.finished) continue;
        const advance = Math.floor(Math.random() * 3) + 1; // 1-3 steps per tick
        horse.position += advance;
        if (horse.position >= TRACK_SLOTS - 1) {
          horse.position = TRACK_SLOTS - 1;
          horse.finished = true;
          horse.finishTick = tick;
          finishOrder.push(horse);
        }
        if (advance > 0) anyProgress = true;
      }

      await buildAndSend();
      if (finishOrder.length === horses.length) {
        break;
      }
      if (!anyProgress) {
        for (const horse of horses) {
          if (!horse.finished) {
            horse.position = TRACK_SLOTS - 1;
            horse.finished = true;
            horse.finishTick = tick;
            finishOrder.push(horse);
          }
        }
        break;
      }
      await wait(TICK_DELAY_MS);
    }

    if (finishOrder.length < horses.length) {
      const remaining = horses.filter(h => !finishOrder.includes(h));
      remaining.sort((a, b) => b.position - a.position);
      finishOrder.push(...remaining);
    }

    stage = 'finished';

    const betsState = calculateBettingState(horses, bets);
    const winningHorse = finishOrder[0];
    const winningOdds = betsState.oddsMap.get(winningHorse.id) || 1.1;
    const winners = [];
    const losers = [];

    for (const [userId, bet] of bets.entries()) {
      if (!bet) continue;
      const amount = Number(bet.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const payout = bet.horseId === winningHorse.id ? amount * winningOdds : 0;
      if (payout > 0) {
        winners.push(`• <@${userId}> won ${formatNumber(payout, 2)} coins (bet ${formatNumber(amount)}).`);
      } else {
        losers.push(`• <@${userId}> lost ${formatNumber(amount)} coins.`);
      }
    }

    const playerSummaryLines = [];
    for (const horse of horses) {
      if (!horse.isPlayer || !horse.userId) continue;
      const placementIndex = finishOrder.indexOf(horse);
      const placementNumber = placementIndex === -1 ? null : placementIndex + 1;
      const stats = recordRace(interaction.guildId, horse.userId, placementNumber);
      const placementLabel = placementNumber
        ? PLACE_EMOJIS[placementIndex] ?? `#${placementNumber}`
        : '#?';
      playerSummaryLines.push(
        `• **${escapeMarkdown(horse.shortName || horse.name)}** ${placementLabel} — 🥇 ${stats.first ?? 0} · 🥈 ${stats.second ?? 0} · 🥉 ${stats.third ?? 0} (Races: ${stats.races ?? 0})`,
      );
    }

    const podium = finishOrder.slice(0, 3)
      .map((horse, idx) => `${PLACE_EMOJIS[idx] ?? `#${idx + 1}`} ${horse.isPlayer ? `**${escapeMarkdown(horse.name)}**` : escapeMarkdown(horse.name)}`)
      .join('\n');

    const summarySections = [];
    if (podium) {
      summarySections.push('**Podium:**', podium);
    }
    if (playerSummaryLines.length) {
      summarySections.push('**Player stats:**', ...playerSummaryLines);
    }

    summarySections.push(`**Winning horse:** ${escapeMarkdown(winningHorse.shortName || winningHorse.name)} (odds ${formatNumber(winningOdds, 2)}x)`);

    if (betsState.totalPool > 0) {
      summarySections.push(`**Betting results — total pot ${formatNumber(betsState.totalPool)} coins:**`);
      if (winners.length) {
        summarySections.push(...winners);
      } else {
        summarySections.push('_No winning bets this time._');
      }
      if (losers.length) {
        summarySections.push(...losers);
      }
    } else {
      summarySections.push('_No bets were placed during this race._');
    }

    finalSummary = summarySections.join('\n');

    await buildAndSend();
    collector.stop('finished');
  },
};
