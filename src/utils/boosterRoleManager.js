const { PermissionsBitField } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs/promises');
const zlib = require('node:zlib');
const boosterStore = require('./boosterRoleStore');
const { resolveDataPath, ensureDir } = require('./dataDir');
// node-fetch v3 is ESM-only; dynamic import for CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));

const ROLE_SUFFIX = "'s Custom Role";
const GRADIENT_ICON_SIZE = 128;
const ROLE_ICON_FEATURE = 'ROLE_ICONS';
const EMBLEM_DIR = 'booster-emblems';
const MAX_EMBLEM_SIZE = 256 * 1024; // 256 KB Discord role icon limit
const EMBLEM_CONTENT_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
]);
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function normalizeHexColor(input) {
  if (!input) return null;
  const match = String(input).trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return null;
  return `#${match[1].toUpperCase()}`;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function colorsEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function normalizeColorConfig(config) {
  if (!config || typeof config !== 'object') return null;
  const mode = config.mode === 'gradient' ? 'gradient' : 'solid';
  const rawColors = Array.isArray(config.colors) ? config.colors : [];

  if (mode === 'solid') {
    const candidate = rawColors[0] ?? config.color ?? config.primary;
    const hex = normalizeHexColor(candidate);
    if (!hex) return null;
    return { mode: 'solid', colors: [hex] };
  }

  const candidates = [];
  if (rawColors.length > 0) candidates.push(...rawColors.slice(0, 2));
  if (candidates.length < 2) {
    if (typeof config.start !== 'undefined') candidates.push(config.start);
    if (typeof config.end !== 'undefined') candidates.push(config.end);
    if (typeof config.secondary !== 'undefined') candidates.push(config.secondary);
  }
  const sanitized = candidates.map(normalizeHexColor).filter(Boolean);
  if (sanitized.length < 2) return null;
  return { mode: 'gradient', colors: sanitized.slice(0, 2) };
}

function colorConfigEquals(a, b) {
  if (!a || !b) return false;
  if (a.mode !== b.mode) return false;
  const colorsA = Array.isArray(a.colors) ? a.colors : [];
  const colorsB = Array.isArray(b.colors) ? b.colors : [];
  if (colorsA.length !== colorsB.length) return false;
  for (let i = 0; i < colorsA.length; i += 1) {
    if (!colorsEqual(colorsA[i], colorsB[i])) return false;
  }
  return true;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function createGradientIconBuffer(startHex, endHex) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  if (!start || !end) throw new Error('Invalid gradient colours provided.');

  const width = GRADIENT_ICON_SIZE;
  const height = GRADIENT_ICON_SIZE;
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const ratio = height === 1 ? 0 : y / (height - 1);
    const r = Math.round(start.r + (end.r - start.r) * ratio);
    const g = Math.round(start.g + (end.g - start.g) * ratio);
    const b = Math.round(start.b + (end.b - start.b) * ratio);
    const rowOffset = y * rowLength;
    raw[rowOffset] = 0; // filter type none
    for (let x = 0; x < width; x += 1) {
      const idx = rowOffset + 1 + x * 4;
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // colour type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function sanitizeNameFragment(input) {
  if (!input) return 'Booster';
  const trimmed = String(input).replace(/[\r\n]/g, ' ').trim();
  return trimmed || 'Booster';
}

function buildDefaultRoleName(member) {
  const base = sanitizeNameFragment(member?.displayName || member?.nickname || member?.user?.username || member?.user?.tag || 'Booster');
  const suffix = ROLE_SUFFIX;
  const maxBaseLength = Math.max(1, 100 - suffix.length);
  let safeBase = base;
  if (safeBase.length > maxBaseLength) {
    safeBase = safeBase.slice(0, maxBaseLength).trim();
    if (!safeBase) safeBase = base.slice(0, maxBaseLength);
  }
  if (!safeBase) safeBase = 'Booster';
  let name = `${safeBase}${suffix}`;
  if (name.length > 100) name = name.slice(0, 100);
  return name;
}

function sanitizeCustomName(name) {
  const trimmed = String(name ?? '').replace(/[\r\n]/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 100);
}

async function fetchMe(guild) {
  if (!guild) return null;
  const existing = guild.members.me;
  if (existing) return existing;
  try { return await guild.members.fetchMe(); } catch (err) { return null; }
}

async function fetchPremiumSubscriberRole(guild) {
  if (!guild || !guild.roles) return null;
  let premiumRole = guild.roles.premiumSubscriberRole || null;
  if (premiumRole) return premiumRole;
  try {
    await guild.roles.fetch();
    premiumRole = guild.roles.premiumSubscriberRole || null;
  } catch (err) {
    console.warn(`Failed to fetch premium subscriber role for ${guild.id}:`, err);
  }
  return premiumRole;
}

function getEmblemExtension(attachment) {
  if (!attachment) return null;
  const contentType = (attachment.contentType || '').toLowerCase();
  if (EMBLEM_CONTENT_TYPES.has(contentType)) {
    return { extension: EMBLEM_CONTENT_TYPES.get(contentType), contentType };
  }
  const name = (attachment.name || '').toLowerCase();
  const match = name.match(/\.(png|jpe?g)$/);
  if (!match) return null;
  const ext = match[0];
  const type = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { extension: ext, contentType: type };
}

async function saveEmblemAsset(guildId, userId, buffer, { extension, contentType, name }) {
  const relativeDir = path.join(EMBLEM_DIR, guildId);
  const fileName = `${userId}${extension}`;
  const relativePath = path.join(relativeDir, fileName);
  const absolutePath = resolveDataPath(relativePath);
  await ensureDir(path.dirname(absolutePath));
  await fs.writeFile(absolutePath, buffer);
  return {
    file: relativePath,
    contentType,
    name: name || null,
    size: buffer.length,
    uploadedAt: new Date().toISOString(),
  };
}

async function loadEmblemBuffer(emblem) {
  if (!emblem || typeof emblem !== 'object' || !emblem.file) return null;
  try {
    return await fs.readFile(resolveDataPath(emblem.file));
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    return null;
  }
}

async function applyRoleEmblem(role, emblem, targetMember, { reason } = {}) {
  if (!role || !emblem) return { iconUpdated: false };
  const buffer = await loadEmblemBuffer(emblem);
  if (!buffer) {
    throw new Error('The stored booster emblem could not be found.');
  }
  const actor = targetMember?.user?.tag || targetMember?.id || 'booster';
  const reasonText = reason || `Updated booster role emblem for ${actor}`;
  try {
    await role.setIcon(buffer, reasonText);
  } catch (err) {
    throw new Error(`Failed to set booster role emblem: ${err.message || err}`);
  }
  return { iconUpdated: true };
}

async function ensureManageable(me, rolePosition) {
  if (!me) throw new Error('Bot member unavailable');
  if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    throw new Error('Missing Manage Roles');
  }
  if (typeof rolePosition === 'number' && me.roles.highest && me.roles.highest.position <= rolePosition) {
    throw new Error('Role hierarchy prevents managing the booster role');
  }
}

async function applyRoleColor(role, colorConfig, targetMember, { reason } = {}) {
  if (!role || !colorConfig) return { colorUpdated: false, iconUpdated: false };

  const actor = targetMember?.user?.tag || targetMember?.id || 'booster';
  const reasonText = reason || `Updated booster role appearance for ${actor}`;

  if (colorConfig.mode === 'solid') {
    const [hex] = colorConfig.colors || [];
    if (!hex) throw new Error('Missing colour value for solid mode.');
    let colorUpdated = false;
    if (!colorsEqual(role.hexColor, hex)) {
      try {
        await role.setColor(hex, reasonText);
        colorUpdated = true;
      } catch (err) {
        throw new Error(`Failed to update booster role colour: ${err.message || err}`);
      }
    }
    let iconUpdated = false;
    if (role.icon) {
      try {
        await role.setIcon(null, reasonText);
        iconUpdated = true;
      } catch (err) {
        throw new Error(`Failed to clear booster role icon: ${err.message || err}`);
      }
    }
    return { colorUpdated, iconUpdated, mode: 'solid' };
  }

  if (colorConfig.mode === 'gradient') {
    const [startHex, endHex] = colorConfig.colors || [];
    if (!startHex || !endHex) throw new Error('Please supply two colours for the gradient.');
    const guild = role.guild;
    const features = Array.isArray(guild?.features) ? guild.features : [];
    if (!features.includes(ROLE_ICON_FEATURE)) {
      throw new Error('This server does not support role icons, so gradient colours are unavailable.');
    }

    let buffer;
    try {
      buffer = createGradientIconBuffer(startHex, endHex);
    } catch (err) {
      throw new Error(err?.message || 'Failed to generate gradient icon.');
    }

    let colorUpdated = false;
    if (!colorsEqual(role.hexColor, startHex)) {
      try {
        await role.setColor(startHex, reasonText);
        colorUpdated = true;
      } catch (err) {
        throw new Error(`Failed to update booster role colour: ${err.message || err}`);
      }
    }

    try {
      await role.setIcon(buffer, reasonText);
    } catch (err) {
      throw new Error(`Failed to set booster role gradient icon: ${err.message || err}`);
    }

    return { colorUpdated, iconUpdated: true, mode: 'gradient' };
  }

  throw new Error('Unsupported colour mode requested.');
}

async function ensureRole(member, { createIfMissing = true, applyStoredColor = true } = {}) {
  if (!member?.guild) throw new Error('Member is not in a guild');
  const guild = member.guild;
  const userId = member.id;
  const guildId = guild.id;

  let targetMember = member;
  if (!targetMember.roles || !targetMember.roles.cache) {
    try {
      targetMember = await guild.members.fetch(userId);
    } catch (err) {
      throw new Error('Failed to fetch member data');
    }
  }

  let roleId = await boosterStore.getRoleId(guildId, userId);
  let role = null;
  if (roleId) {
    try { role = await guild.roles.fetch(roleId); } catch (_) { role = null; }
    if (!role) {
      await boosterStore.deleteRole(guildId, userId);
      roleId = null;
    }
  }

  const me = await fetchMe(guild);
  await ensureManageable(me, role?.position);

  const premiumRole = await fetchPremiumSubscriberRole(guild);
  let desiredPosition = null;
  if (premiumRole && typeof premiumRole.position === 'number') {
    desiredPosition = premiumRole.position + 1;
    await ensureManageable(me, desiredPosition);
  }

  if (!role && createIfMissing) {
    const name = buildDefaultRoleName(targetMember);
    role = await guild.roles.create({
      name,
      reason: `Custom booster role created for ${targetMember.user?.tag || targetMember.id}`,
      mentionable: false,
    });
    await boosterStore.setRoleId(guildId, userId, role.id);
  }

  if (role) {
    if (
      premiumRole &&
      typeof premiumRole.position === 'number' &&
      (typeof role.position !== 'number' || role.position <= premiumRole.position)
    ) {
      const anchorName = premiumRole.name || 'Server Booster';
      try {
        role = await role.setPosition(desiredPosition, `Aligning booster custom role above ${anchorName}`);
      } catch (err) {
        throw new Error(`Failed to position booster role: ${err.message || err}`);
      }
    }

    if (me.roles.highest && me.roles.highest.comparePositionTo(role) <= 0) {
      throw new Error('Role hierarchy prevents managing the booster role');
    }
    const hasRole = targetMember.roles.cache.has(role.id);
    if (!hasRole) {
      try {
        await targetMember.roles.add(role, 'Assigning booster custom role');
      } catch (err) {
        throw new Error(`Failed to assign booster role: ${err.message || err}`);
      }
    }
  }

  if (role && applyStoredColor) {
    let storedConfig = null;
    try {
      storedConfig = await boosterStore.getColorConfig(guildId, userId);
    } catch (err) {
      console.warn(`Failed to read stored booster colour for ${userId} in ${guildId}:`, err);
    }
    if (storedConfig) {
      try {
        await applyRoleColor(role, storedConfig, targetMember, {
          reason: `Reapplying saved booster colour for ${targetMember.user?.tag || targetMember.id}`,
        });
      } catch (err) {
        console.warn(`Failed to reapply booster colour for ${userId} in ${guildId}:`, err);
      }
    }

    let storedEmblem = null;
    try {
      storedEmblem = await boosterStore.getEmblem(guildId, userId);
    } catch (err) {
      console.warn(`Failed to read stored booster emblem for ${userId} in ${guildId}:`, err);
    }
    if (storedEmblem) {
      try {
        await applyRoleEmblem(role, storedEmblem, targetMember, {
          reason: `Reapplying saved booster emblem for ${targetMember.user?.tag || targetMember.id}`,
        });
      } catch (err) {
        console.warn(`Failed to reapply booster emblem for ${userId} in ${guildId}:`, err);
      }
    }
  }

  return { role, created: !!(!roleId && role), member: targetMember };
}

module.exports = {
  ROLE_SUFFIX,
  buildDefaultRoleName,
  sanitizeCustomName,
  ensureRole,
  normalizeColorConfig,
  async renameRole(member, desiredName) {
    const name = sanitizeCustomName(desiredName);
    if (!name) throw new Error('Please provide a non-empty name.');

    const { role, member: targetMember } = await ensureRole(member, { createIfMissing: true });
    if (!role) throw new Error('You do not have a booster role yet.');

    const guild = targetMember.guild;
    const me = await fetchMe(guild);
    await ensureManageable(me, role.position);

    if (role.name === name) {
      return role;
    }

    try {
      const updated = await role.setName(name, `Renamed by ${targetMember.user?.tag || targetMember.id}`);
      return updated;
    } catch (err) {
      throw new Error(`Failed to rename booster role: ${err.message || err}`);
    }
  },
  async updateRoleColor(member, colorInput) {
    const normalized = normalizeColorConfig(colorInput);
    if (!normalized) {
      throw new Error('Please provide valid hex colours (example: #ff8800).');
    }

    const { role, member: targetMember } = await ensureRole(member, {
      createIfMissing: true,
      applyStoredColor: false,
    });
    if (!role) throw new Error('You do not have a booster role yet.');

    const guild = targetMember.guild;
    const me = await fetchMe(guild);
    await ensureManageable(me, role.position);

    let existingConfig = null;
    try {
      existingConfig = await boosterStore.getColorConfig(guild.id, targetMember.id);
    } catch (err) {
      console.warn(`Failed to read existing booster colour for ${targetMember.id} in ${guild.id}:`, err);
    }

    let existingEmblem = null;
    try {
      existingEmblem = await boosterStore.getEmblem(guild.id, targetMember.id);
    } catch (err) {
      console.warn(`Failed to read existing booster emblem for ${targetMember.id} in ${guild.id}:`, err);
    }

    let result;
    try {
      result = await applyRoleColor(role, normalized, targetMember, {
        reason: `Booster role colour updated by ${targetMember.user?.tag || targetMember.id}`,
      });
    } catch (err) {
      throw err instanceof Error ? err : new Error(err);
    }

    await boosterStore.setColorConfig(guild.id, targetMember.id, normalized);

    if (normalized.mode === 'gradient') {
      await boosterStore.setEmblem(guild.id, targetMember.id, null);
    } else if (existingEmblem) {
      try {
        await applyRoleEmblem(role, existingEmblem, targetMember, {
          reason: `Reapplying booster emblem after colour update for ${targetMember.user?.tag || targetMember.id}`,
        });
      } catch (err) {
        console.warn(`Failed to restore booster emblem for ${targetMember.id} in ${guild.id}:`, err);
      }
    }

    return { role, config: normalized, result, unchanged: colorConfigEquals(existingConfig, normalized) };
  },

  async updateRoleEmblem(member, { attachment, clear = false } = {}) {
    if (!member?.guild) throw new Error('Member is not in a guild');

    const { role, member: targetMember } = await ensureRole(member, {
      createIfMissing: true,
      applyStoredColor: false,
    });
    if (!role) throw new Error('You do not have a booster role yet.');

    const guild = targetMember.guild;
    const me = await fetchMe(guild);
    await ensureManageable(me, role.position);

    const guildFeatures = Array.isArray(guild?.features) ? guild.features : [];
    if (!guildFeatures.includes(ROLE_ICON_FEATURE)) {
      throw new Error('This server does not support role icons, so booster emblems are unavailable.');
    }

    let existingEmblem = null;
    try {
      existingEmblem = await boosterStore.getEmblem(guild.id, targetMember.id);
    } catch (err) {
      console.warn(`Failed to read existing booster emblem for ${targetMember.id} in ${guild.id}:`, err);
    }

    const actor = targetMember.user?.tag || targetMember.id;

    if (clear) {
      try {
        await role.setIcon(null, `Booster emblem cleared by ${actor}`);
      } catch (err) {
        throw new Error(`Failed to clear booster role emblem: ${err.message || err}`);
      }
      await boosterStore.setEmblem(guild.id, targetMember.id, null);
      return { role, emblem: null, cleared: true, hadExisting: !!existingEmblem };
    }

    if (!attachment) {
      throw new Error('Please attach a PNG or JPEG image to use as your booster emblem.');
    }

    if (attachment.size && attachment.size > MAX_EMBLEM_SIZE) {
      throw new Error('Please choose an image that is 256 KB or smaller.');
    }

    const extInfo = getEmblemExtension(attachment);
    if (!extInfo) {
      throw new Error('Please provide a PNG or JPEG image to use as your booster emblem.');
    }

    let response;
    try {
      response = await fetch(attachment.url);
    } catch (err) {
      throw new Error(`Failed to download the provided emblem: ${err.message || err}`);
    }
    if (!response?.ok) {
      throw new Error(`Failed to download the provided emblem (status ${response?.status || 'unknown'}).`);
    }

    let buffer;
    try {
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } catch (err) {
      throw new Error('The provided emblem image could not be processed.');
    }

    if (!buffer?.length) {
      throw new Error('The provided emblem image is empty.');
    }

    if (buffer.length > MAX_EMBLEM_SIZE) {
      throw new Error('Please choose an image that is 256 KB or smaller.');
    }

    const metadata = await saveEmblemAsset(guild.id, targetMember.id, buffer, {
      extension: extInfo.extension,
      contentType: extInfo.contentType,
      name: attachment.name || null,
    });

    try {
      await role.setIcon(buffer, `Booster emblem updated by ${actor}`);
    } catch (err) {
      try {
        await fs.unlink(resolveDataPath(metadata.file));
      } catch (cleanupErr) {
        if (cleanupErr?.code !== 'ENOENT') {
          console.warn(`Failed to clean up booster emblem asset ${metadata.file} after error:`, cleanupErr);
        }
      }
      throw new Error(`Failed to update booster role emblem: ${err.message || err}`);
    }

    await boosterStore.setEmblem(guild.id, targetMember.id, metadata);

    return { role, emblem: metadata, cleared: false, hadExisting: !!existingEmblem };
  },
};
