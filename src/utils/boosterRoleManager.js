const { PermissionsBitField } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs/promises');
const boosterStore = require('./boosterRoleStore');
const { resolveDataPath, ensureDir } = require('./dataDir');
// node-fetch v3 is ESM-only; dynamic import for CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetchFn }) => fetchFn(...args));

const ROLE_SUFFIX = "'s Custom Role";
const ROLE_ICON_FEATURE = 'ROLE_ICONS';
const EMBLEM_DIR = 'booster-emblems';
const MAX_EMBLEM_SIZE = 256 * 1024; // 256 KB Discord role icon limit
const EMBLEM_CONTENT_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
]);
function normalizeHexColor(input) {
  if (!input) return null;
  const match = String(input).trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!match) return null;
  return `#${match[1].toUpperCase()}`;
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
  const contentType = typeof emblem?.contentType === 'string' ? emblem.contentType.trim().toLowerCase() : '';
  const payload = contentType && contentType.startsWith('image/')
    ? `data:${contentType};base64,${buffer.toString('base64')}`
    : buffer;
  try {
    await role.setIcon(payload, reasonText);
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

    const desiredPrimaryInt = parseInt(startHex.slice(1), 16);
    const desiredSecondaryInt = parseInt(endHex.slice(1), 16);
    const currentColors = role.colors || {};
    const currentPrimary = typeof currentColors.primaryColor === 'number' ? currentColors.primaryColor : null;
    const currentSecondary = typeof currentColors.secondaryColor === 'number' ? currentColors.secondaryColor : null;
    const currentTertiary = typeof currentColors.tertiaryColor === 'number' ? currentColors.tertiaryColor : null;

    const needsUpdate =
      currentPrimary !== desiredPrimaryInt ||
      currentSecondary !== desiredSecondaryInt ||
      currentTertiary !== null;

    let colorUpdated = false;
    if (needsUpdate) {
      try {
        await role.setColors(
          { primaryColor: startHex, secondaryColor: endHex },
          reasonText,
        );
        colorUpdated = true;
      } catch (err) {
        throw new Error(`Failed to update booster role gradient colours: ${err.message || err}`);
      }
    }

    return { colorUpdated, iconUpdated: false, mode: 'gradient' };
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

    if (existingEmblem) {
      try {
        await applyRoleEmblem(role, existingEmblem, targetMember, {
          reason: `Reapplying booster emblem after colour update for ${targetMember.user?.tag || targetMember.id}`,
        });
      } catch (err) {
        console.warn(`Failed to restore booster emblem for ${targetMember.id} in ${guild.id}:`, err);
      }
    } else if (normalized.mode === 'gradient' && role.icon) {
      try {
        await role.setIcon(null, `Clearing booster emblem after gradient colour update for ${targetMember.user?.tag || targetMember.id}`);
      } catch (err) {
        console.warn(`Failed to clear booster emblem for ${targetMember.id} in ${guild.id}:`, err);
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

    const uploadContentType = (extInfo.contentType || 'image/png').toLowerCase();
    const dataUri = `data:${uploadContentType};base64,${buffer.toString('base64')}`;

    try {
      await role.setIcon(dataUri, `Booster emblem updated by ${actor}`);
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
