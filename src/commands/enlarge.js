const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
// node-fetch v3 is ESM-only; use dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// ----- Unicode emoji helpers (Twemoji) -----
function cpArray(str) {
  const out = [];
  for (const ch of str) out.push(ch.codePointAt(0));
  return out;
}

function isPictographic(cp) {
  // Broad, pragmatic coverage for common emoji blocks
  return (
    (cp >= 0x1F000 && cp <= 0x1FAFF) || // Misc pictographs, Supplemental Symbols & Pictographs
    (cp >= 0x2300 && cp <= 0x27FF) ||   // Misc technical + dingbats + arrows, etc.
    (cp >= 0x2B00 && cp <= 0x2BFF) ||   // Misc symbols and arrows
    (cp >= 0x2600 && cp <= 0x26FF)      // Dingbats range
  );
}

function extractFirstEmojiCluster(input) {
  if (!input) return null;
  const cps = cpArray(input.trim());
  const VS15 = 0xFE0E;
  const VS16 = 0xFE0F;
  const ZWJ = 0x200D;
  const SKIN_START = 0x1F3FB;
  const SKIN_END = 0x1F3FF;

  for (let i = 0; i < cps.length; i++) {
    if (!isPictographic(cps[i])) continue;
    const cluster = [cps[i]];
    let j = i + 1;
    // Optional VS
    if (j < cps.length && (cps[j] === VS15 || cps[j] === VS16)) {
      cluster.push(cps[j]);
      j++;
    }
    // Optional skin tone
    if (j < cps.length && cps[j] >= SKIN_START && cps[j] <= SKIN_END) {
      cluster.push(cps[j]);
      j++;
    }
    // Handle ZWJ sequences
    while (j < cps.length && cps[j] === ZWJ) {
      cluster.push(ZWJ);
      j++;
      if (j >= cps.length) break;
      if (!isPictographic(cps[j])) break;
      cluster.push(cps[j]);
      j++;
      if (j < cps.length && (cps[j] === VS15 || cps[j] === VS16)) {
        cluster.push(cps[j]);
        j++;
      }
      if (j < cps.length && cps[j] >= SKIN_START && cps[j] <= SKIN_END) {
        cluster.push(cps[j]);
        j++;
      }
    }
    return cluster;
  }
  return null;
}

function codePointsToTwemojiHex(cpList) {
  return cpList.map(cp => cp.toString(16)).join('-');
}

function unicodeEmojiToTwemojiUrl(input) {
  const cluster = extractFirstEmojiCluster(input);
  if (!cluster) return null;
  const hex = codePointsToTwemojiHex(cluster);
  // Use Twemoji PNG assets (72x72). These upscale fine in Discord UI.
  return { url: `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/72x72/${hex}.png`, name: `${hex}.png` };
}

function parseEmojiInput(input) {
  if (!input) return null;
  // <a:name:id> or <:name:id>
  const mention = input.match(/^<(?:(a):)?([a-zA-Z0-9_]{2,32}):([0-9]{15,25})>$/);
  if (mention) {
    return { id: mention[3], name: mention[2], animated: Boolean(mention[1]), explicitUrl: null };
  }
  // CDN URL
  const urlMatch = input.match(/discord(?:app)?\.com\/emojis\/([0-9]{15,25})\.(png|webp|gif)/i);
  if (urlMatch) {
    const ext = urlMatch[2].toLowerCase();
    return { id: urlMatch[1], name: undefined, animated: ext === 'gif', explicitUrl: input };
  }
  // Raw ID
  const idMatch = input.match(/^([0-9]{15,25})$/);
  if (idMatch) return { id: idMatch[1], name: undefined, animated: false, explicitUrl: null };
  return null;
}

function emojiCdnUrl(id, animated, size = 512) {
  const ext = animated ? 'gif' : 'png';
  const clamped = [16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 288, 320, 384, 448, 512, 576, 640, 768, 896, 1024, 1280, 1536, 1792, 2048, 4096]
    .reduce((prev, curr) => (Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev), 512);
  return `https://cdn.discordapp.com/emojis/${id}.${ext}?size=${clamped}&quality=lossless`;
}

async function fetchStickerBufferByIdOrUrl(idOrUrl) {
  const tryUrls = [];
  if (/^[0-9]{15,25}$/.test(idOrUrl)) {
    for (const ext of ['png', 'apng', 'gif', 'json']) {
      tryUrls.push(`https://cdn.discordapp.com/stickers/${idOrUrl}.${ext}`);
    }
  } else if (/^https?:\/\//i.test(idOrUrl)) {
    tryUrls.push(idOrUrl);
  } else {
    return null;
  }

  for (const url of tryUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.buffer();
        if (buf && buf.length > 0) return { buffer: buf, sourceUrl: url };
      }
    } catch (_) {
      // continue
    }
  }
  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enlarge')
    .setDescription('Enlarge an emoji or sticker and post it as an image')
    .addSubcommand(sub =>
      sub
        .setName('emoji')
        .setDescription('Enlarge a custom emoji by mention, ID, or URL')
        .addStringOption(opt =>
          opt.setName('input').setDescription('Emoji <:name:id>, ID, or CDN URL').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('size')
            .setDescription('Output size (for emojis)')
            .addChoices(
              { name: '128', value: 128 },
              { name: '256', value: 256 },
              { name: '512', value: 512 },
              { name: '1024', value: 1024 },
              { name: '2048', value: 2048 },
              { name: '4096', value: 4096 },
            )
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('sticker')
        .setDescription('Enlarge a sticker by ID, URL, or file')
        .addStringOption(opt =>
          opt.setName('id_or_url').setDescription('Sticker ID or CDN URL').setRequired(false)
        )
        .addAttachmentOption(opt =>
          opt.setName('file').setDescription('Sticker file (PNG/APNG/JSON)').setRequired(false)
        )
    ),

  async execute(interaction) {
    // Acknowledge immediately to avoid timeouts. If that fails, fall back to a channel message we can edit.
    let acknowledged = false;
    let channelMsg = null;
    try {
      await interaction.reply({ content: 'Fetching media…' });
      acknowledged = true;
    } catch (_) {
      try {
        if (interaction.channel?.send) {
          channelMsg = await interaction.channel.send('Fetching media…');
        }
      } catch (_) {
        // ignore; we will try again later
      }
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'emoji') {
      const input = interaction.options.getString('input', true);
      const size = interaction.options.getInteger('size') ?? 512;
      let parsed = parseEmojiInput(input);
      // Allow Unicode emoji via Twemoji as a fallback
      let unicodeFallback = null;
      if (!parsed) {
        unicodeFallback = unicodeEmojiToTwemojiUrl(input);
      }
      if (!parsed && !unicodeFallback) {
        const msg = 'Provide a custom emoji mention like <:name:id>, an emoji ID, a valid CDN URL, or a Unicode emoji (😀, 👩‍💻, etc.).';
        if (acknowledged) return interaction.editReply({ content: msg });
        if (channelMsg) return channelMsg.edit(msg);
        return;
      }

      const url = unicodeFallback ? unicodeFallback.url : (parsed.explicitUrl || emojiCdnUrl(parsed.id, parsed.animated, size));
      const fileName = unicodeFallback ? unicodeFallback.name : `${parsed.name || parsed.id}.${parsed.animated ? 'gif' : 'png'}`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Download failed');
        const buf = await res.buffer();
        const attachment = new AttachmentBuilder(buf, { name: fileName });
        if (acknowledged) return interaction.editReply({ content: url, files: [attachment] });
        if (channelMsg) return channelMsg.edit({ content: url, files: [attachment] });
        return;
      } catch (err) {
        const msg = `Failed to fetch emoji image. URL: ${url}`;
        if (acknowledged) return interaction.editReply({ content: msg });
        if (channelMsg) return channelMsg.edit(msg);
        return;
      }
    }

    if (sub === 'sticker') {
      const idOrUrl = interaction.options.getString('id_or_url');
      const file = interaction.options.getAttachment('file');

      let buffer = null;
      let urlUsed = null;
      try {
        if (file?.url) {
          const res = await fetch(file.url);
          if (!res.ok) throw new Error('Download failed');
          buffer = await res.buffer();
          urlUsed = file.url;
        } else if (idOrUrl) {
          const result = await fetchStickerBufferByIdOrUrl(idOrUrl);
          if (!result) throw new Error('Could not resolve that sticker');
          buffer = result.buffer;
          urlUsed = result.sourceUrl;
        } else {
          const msg = 'Provide a sticker ID/URL or attach a sticker file.';
          if (acknowledged) return interaction.editReply({ content: msg });
          if (channelMsg) return channelMsg.edit(msg);
          return;
        }
      } catch (err) {
        const msg = `Failed to fetch sticker: ${err.message}`;
        if (acknowledged) return interaction.editReply({ content: msg });
        if (channelMsg) return channelMsg.edit(msg);
        return;
      }

      // Guess extension from URL if possible
      const guessedExt = (urlUsed && (urlUsed.match(/\.([a-z0-9]+)(?:\?.*)?$/i)?.[1] || 'png')) || 'png';
      const attachment = new AttachmentBuilder(buffer, { name: `sticker.${guessedExt}` });
      if (acknowledged) return interaction.editReply({ content: urlUsed || 'Here is the sticker file:', files: [attachment] });
      if (channelMsg) return channelMsg.edit({ content: urlUsed || 'Here is the sticker file:', files: [attachment] });
      return;
    }

    const fallback = 'Unknown subcommand.';
    if (acknowledged) return interaction.editReply({ content: fallback });
    if (channelMsg) return channelMsg.edit(fallback);
    return;
  },
};
