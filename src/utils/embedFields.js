const { EmbedBuilder } = require('discord.js');
const { resolveEmbedColour } = require('./guildColourStore');

const DEFAULT_COLOR = 0x5865F2;
const FIELD_CHUNK_SIZE = 1024;
const EMBED_CHAR_LIMIT = 6000;
const MAX_FIELDS_PER_EMBED = 25;

function chunkText(text, size = FIELD_CHUNK_SIZE) {
  if (!text) return [];
  const str = String(text);
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

function createFieldEmbeds({
  title,
  sections,
  user,
  description,
  guildId,
  color = null,
  inline = false,
}) {
  if (!Array.isArray(sections) || !sections.length) return [];

  const avatarUrl = typeof user?.displayAvatarURL === 'function'
    ? user.displayAvatarURL({ size: 256 })
    : null;

  const expandedFields = [];
  for (const section of sections) {
    if (!section || !section.name) continue;
    const baseName = String(section.name);
    const value = section.value == null ? '' : String(section.value);
    const chunks = chunkText(value, FIELD_CHUNK_SIZE);
    if (!chunks.length) {
      expandedFields.push({ name: baseName, value: '\u200b', inline });
      continue;
    }
    chunks.forEach((chunk, idx) => {
      const name = chunks.length === 1
        ? baseName
        : `${baseName} (part ${idx + 1})`;
      expandedFields.push({ name, value: chunk, inline });
    });
  }

  const embeds = [];
  let embedIndex = 0;
  let currentEmbed = null;
  let currentLength = 0;
  let currentFieldCount = 0;

  const startNewEmbed = () => {
    const suffix = embedIndex === 0 ? '' : ` (cont. ${embedIndex})`;
    const computedTitle = title ? `${title}${suffix}` : null;
    const resolvedColor = color ?? resolveEmbedColour(guildId, DEFAULT_COLOR);
    currentEmbed = new EmbedBuilder()
      .setColor(resolvedColor);
    if (computedTitle) {
      currentEmbed.setTitle(computedTitle);
    }
    if (description && embedIndex === 0) {
      currentEmbed.setDescription(description);
      currentLength = description.length + (computedTitle ? computedTitle.length : 0);
    } else {
      currentLength = computedTitle ? computedTitle.length : 0;
    }
    if (avatarUrl && embedIndex === 0) {
      currentEmbed.setThumbnail(avatarUrl);
    }
    currentFieldCount = 0;
    embedIndex += 1;
  };

  for (const field of expandedFields) {
    if (!currentEmbed) startNewEmbed();
    const additionalLength = (field.name?.length || 0) + (field.value?.length || 0);
    const wouldExceedLength = (currentLength + additionalLength) > EMBED_CHAR_LIMIT;
    const wouldExceedCount = currentFieldCount >= MAX_FIELDS_PER_EMBED;

    if (wouldExceedLength || wouldExceedCount) {
      embeds.push(currentEmbed);
      startNewEmbed();
    }

    currentEmbed.addFields(field);
    currentLength += additionalLength;
    currentFieldCount += 1;
  }

  if (currentEmbed) {
    embeds.push(currentEmbed);
  }

  return embeds;
}

module.exports = {
  chunkText,
  createFieldEmbeds,
};
