function parseOwnerIds() {
  const raw = process.env.BOT_OWNER_IDS || '';
  const ids = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  if (ids.length) return ids;
  const single = process.env.BOT_OWNER_ID;
  return single ? [String(single).trim()] : [];
}

function isOwner(userId) {
  return parseOwnerIds().includes(String(userId));
}

module.exports = { parseOwnerIds, isOwner };
