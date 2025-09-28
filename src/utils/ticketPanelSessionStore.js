const sessions = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000;

function makeKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function purgeExpired(now = Date.now()) {
  for (const [key, value] of sessions.entries()) {
    if (!value || typeof value !== 'object') {
      sessions.delete(key);
      continue;
    }
    const ttl = typeof value.ttlMs === 'number' ? value.ttlMs : DEFAULT_TTL_MS;
    if (value.createdAt && now - value.createdAt > ttl) {
      sessions.delete(key);
    }
  }
}

function createSession(guildId, userId, data, ttlMs = DEFAULT_TTL_MS) {
  if (!guildId || !userId) return null;
  purgeExpired();
  const key = makeKey(guildId, userId);
  const payload = {
    ...data,
    createdAt: Date.now(),
    ttlMs: ttlMs || DEFAULT_TTL_MS,
  };
  sessions.set(key, payload);
  return payload;
}

function getSession(guildId, userId) {
  purgeExpired();
  return sessions.get(makeKey(guildId, userId)) || null;
}

function consumeSession(guildId, userId) {
  const key = makeKey(guildId, userId);
  const value = getSession(guildId, userId);
  sessions.delete(key);
  return value;
}

module.exports = {
  createSession,
  getSession,
  consumeSession,
};
