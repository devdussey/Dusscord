// Ephemeral in-memory sessions for verification captcha
// Key: `${guildId}:${userId}` -> { code, roleId, minAccountAgeDays, expiresAt, attempts }

const sessions = new Map();

const KEY = (g, u) => `${g}:${u}`;

function create(guildId, userId, data) {
  const now = Date.now();
  const entry = {
    code: data.code,
    roleId: data.roleId,
    minAccountAgeDays: Math.max(0, data.minAccountAgeDays || 0),
    expiresAt: now + (data.ttlMs || 3 * 60 * 1000), // default 3 minutes
    attempts: data.attempts || 3,
  };
  sessions.set(KEY(guildId, userId), entry);
  return entry;
}

function get(guildId, userId) {
  const k = KEY(guildId, userId);
  const entry = sessions.get(k);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    sessions.delete(k);
    return null;
  }
  return entry;
}

function consumeAttempt(guildId, userId) {
  const e = get(guildId, userId);
  if (!e) return null;
  e.attempts = Math.max(0, (e.attempts || 0) - 1);
  if (e.attempts <= 0) {
    sessions.delete(KEY(guildId, userId));
  }
  return e;
}

function clear(guildId, userId) {
  return sessions.delete(KEY(guildId, userId));
}

module.exports = { create, get, clear, consumeAttempt };

