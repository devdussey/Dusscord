const { SlashCommandBuilder, escapeMarkdown } = require('discord.js');
const { recordRace } = require('../utils/horseRaceStore');

const TRACK_SLOTS = 20;
const TICK_DELAY_MS = 1200;
const MAX_TICKS = 18;
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

function renderRace(horses, finishOrder, { finished, tick }) {
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
    return `${lane} ${track} ${label}${suffix}`;
  });

  const footer = finished ? '_Race complete!_' : '_Cheer on your favourite horse!_';
  return `${header}\n\n${lines.join('\n')}\n\n${footer}`;
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

    const displayName = interaction.member?.displayName || interaction.user.username;
    const npcNames = pickNpcNames(3, new Set([displayName]));
    const horses = [
      {
        id: interaction.user.id,
        name: displayName,
        shortName: displayName,
        isPlayer: true,
        position: 0,
        finished: false,
        finishTick: Number.POSITIVE_INFINITY,
      },
      ...npcNames.map((name, idx) => ({
        id: `npc-${idx}-${Date.now()}`,
        name,
        shortName: name,
        isPlayer: false,
        position: 0,
        finished: false,
        finishTick: Number.POSITIVE_INFINITY,
      })),
    ];

    const finishOrder = [];

    const sendContent = async (content) => {
      try {
        await interaction.editReply({ content, allowedMentions: { parse: [] } });
      } catch (err) {
        console.error('Failed to update horserace message:', err);
      }
    };

    await interaction.deferReply();
    await sendContent(renderRace(horses, finishOrder, { finished: false, tick: 0 }));

    for (let tick = 1; tick <= MAX_TICKS; tick += 1) {
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

      await sendContent(renderRace(horses, finishOrder, { finished: false, tick }));
      if (finishOrder.length === horses.length) {
        break;
      }
      if (!anyProgress) {
        // Prevent infinite loops if all horses are somehow stuck.
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

    const playerHorse = horses.find(h => h.isPlayer);
    const placementIndex = finishOrder.indexOf(playerHorse);
    const placementNumber = placementIndex === -1 ? null : placementIndex + 1;
    const stats = recordRace(interaction.guildId, interaction.user.id, placementNumber);

    const podium = finishOrder.slice(0, 3)
      .map((horse, idx) => `${PLACE_EMOJIS[idx] ?? `#${idx + 1}`} ${horse.isPlayer ? `**${escapeMarkdown(horse.name)}**` : escapeMarkdown(horse.name)}`)
      .join('\n');
    const personal = `**Your stats:** 🥇 ${stats.first ?? 0} · 🥈 ${stats.second ?? 0} · 🥉 ${stats.third ?? 0} (Total races: ${stats.races ?? 0})`;
    const placementLine = placementNumber
      ? `You finished ${PLACE_EMOJIS[placementIndex] ?? `#${placementNumber}`} this time.`
      : 'Race results recorded.';

    const summaryLines = [placementLine, personal];
    if (podium) {
      summaryLines.unshift('**Podium:**', podium);
    }

    await sendContent(`${renderRace(horses, finishOrder, { finished: true, tick: MAX_TICKS })}\n\n${summaryLines.join('\n')}`);
  },
};
