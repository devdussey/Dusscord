function parseOwnerIds() {
  const raw = process.env.BOT_OWNER_IDS || '';
  return raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}

module.exports = { parseOwnerIds };
