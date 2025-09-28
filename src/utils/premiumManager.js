const { ensureFileSync, readJsonSync, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'premium.json';
const DEFAULT_STATE = { users: {}, guilds: {} };
const VOTE_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

const staticUserPremium = parseIdSet(process.env.PREMIUM_USER_IDS || process.env.PREMIUM_USERS);
const staticGuildPremium = parseIdSet(process.env.PREMIUM_GUILD_IDS || process.env.PREMIUM_GUILDS);

let cache = null;

function parseIdSet(raw) {
  return new Set(
    String(raw || '')
      .split(/[\s,]+/)
      .map(id => id.trim())
      .filter(Boolean)
  );
}

function load() {
  if (!cache) {
    ensureFileSync(STORE_FILE, DEFAULT_STATE);
    const data = readJsonSync(STORE_FILE, DEFAULT_STATE) || DEFAULT_STATE;
    cache = {
      users: { ...(data.users || {}) },
      guilds: { ...(data.guilds || {}) },
    };
    cleanupExpired();
  }
  return cache;
}

function save() {
  if (!cache) return;
  writeJsonSync(STORE_FILE, cache);
}

function cleanupExpired() {
  if (!cache) return;
  const now = Date.now();
  let changed = false;
  for (const [userId, entry] of Object.entries(cache.users)) {
    if (!entry) continue;
    if (!entry.permanent && entry.expiresAt && entry.expiresAt <= now) {
      delete cache.users[userId];
      changed = true;
    }
  }
  for (const [guildId, entry] of Object.entries(cache.guilds)) {
    if (!entry) continue;
    if (!entry.permanent && entry.expiresAt && entry.expiresAt <= now) {
      delete cache.guilds[guildId];
      changed = true;
    }
  }
  if (changed) save();
}

function getUserEntry(userId) {
  if (!userId) return null;
  const data = load();
  const entry = data.users[userId];
  if (!entry) return null;
  if (!entry.permanent && entry.expiresAt && entry.expiresAt <= Date.now()) {
    delete data.users[userId];
    save();
    return null;
  }
  return entry;
}

function getGuildEntry(guildId) {
  if (!guildId) return null;
  const data = load();
  const entry = data.guilds[guildId];
  if (!entry) return null;
  if (!entry.permanent && entry.expiresAt && entry.expiresAt <= Date.now()) {
    delete data.guilds[guildId];
    save();
    return null;
  }
  return entry;
}

function isGuildBoosted(guild) {
  if (!guild) return false;
  if (typeof guild.premiumSubscriptionCount === 'number' && guild.premiumSubscriptionCount > 0) return true;
  if (typeof guild.premiumTier === 'number' && guild.premiumTier > 0) return true;
  if (guild.premiumTier && guild.premiumTier !== 'NONE') return true;
  return false;
}

function isMemberBoosting(member) {
  if (!member) return false;
  return Boolean(member.premiumSince || member.premiumSinceTimestamp);
}

function hasUserPremium(userId) {
  if (!userId) return false;
  const id = String(userId);
  if (staticUserPremium.has(id)) return true;
  const entry = getUserEntry(id);
  if (!entry) return false;
  if (entry.permanent) return true;
  return Boolean(entry.expiresAt && entry.expiresAt > Date.now());
}

function hasGuildPremium(guildId) {
  if (!guildId) return false;
  const id = String(guildId);
  if (staticGuildPremium.has(id)) return true;
  const entry = getGuildEntry(id);
  if (!entry) return false;
  if (entry.permanent) return true;
  return Boolean(entry.expiresAt && entry.expiresAt > Date.now());
}

function hasPremiumAccess(guild, member, user) {
  if (user && hasUserPremium(user.id || user)) return true;
  if (!guild) return false;
  if (hasGuildPremium(guild.id || guild)) return true;
  if (isGuildBoosted(guild)) return true;
  if (member && isMemberBoosting(member)) return true;
  return false;
}

function setUserPremium(userId, options = {}) {
  if (!userId) return null;
  const data = load();
  const id = String(userId);
  const existing = data.users[id] || {};
  const next = { ...existing };
  if (options.permanent) {
    next.permanent = true;
  }
  if (options.expiresAt) {
    next.expiresAt = Math.max(Number(options.expiresAt) || 0, existing.expiresAt || 0);
  }
  data.users[id] = next;
  save();
  return next;
}

function setGuildPremium(guildId, options = {}) {
  if (!guildId) return null;
  const data = load();
  const id = String(guildId);
  const existing = data.guilds[id] || {};
  const next = { ...existing };
  if (options.permanent) {
    next.permanent = true;
  }
  if (options.expiresAt) {
    next.expiresAt = Math.max(Number(options.expiresAt) || 0, existing.expiresAt || 0);
  }
  data.guilds[id] = next;
  save();
  return next;
}

function grantVotePremium(userId, durationMs = VOTE_DURATION_MS) {
  if (!userId) return null;
  const expiresAt = Date.now() + Math.max(0, Number(durationMs) || 0);
  return setUserPremium(userId, { expiresAt });
}

function buildUpsellMessage(featureName, options = {}) {
  const lines = [];
  if (featureName) {
    lines.push(`🔒 ${featureName} is a Premium feature.`);
  } else {
    lines.push('🔒 This is a Premium feature.');
  }
  lines.push('Unlock Premium for $4.99 USD or keep an active Server Boost to access it.');
  lines.push('Voting grants 12 hours of Premium access — boost or buy to keep it permanently.');
  if (typeof options.freebiesRemaining === 'number' && typeof options.freebiesTotal === 'number') {
    lines.push(`Free daily uses remaining: ${options.freebiesRemaining} of ${options.freebiesTotal}.`);
  }
  if (options.extraNote) {
    lines.push(options.extraNote);
  }
  return lines.join('\n');
}

async function ensurePremium(interaction, featureName, options = {}) {
  const guild = interaction.guild ?? null;
  const member = interaction.member ?? null;
  const user = interaction.user ?? null;
  if (hasPremiumAccess(guild, member, user)) {
    return true;
  }
  const message = buildUpsellMessage(featureName, options);
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
  } catch (err) {
    console.warn('Failed to send premium upsell message:', err?.message || err);
  }
  return false;
}

module.exports = {
  hasPremiumAccess,
  hasUserPremium,
  hasGuildPremium,
  isGuildBoosted,
  ensurePremium,
  buildUpsellMessage,
  setUserPremium,
  setGuildPremium,
  grantVotePremium,
};
