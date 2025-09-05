const { parseOwnerIds } = require('./ownerIds');

function formatArg(a) {
  try {
    if (a instanceof Error) return a.stack || `${a.name}: ${a.message}`;
    if (typeof a === 'object') return JSON.stringify(a, null, 2);
    return String(a);
  } catch (_) {
    try { return String(a); } catch { return '[Unprintable]'; }
  }
}

function chunkString(str, n) {
  const out = [];
  for (let i = 0; i < str.length; i += n) out.push(str.slice(i, i + n));
  return out;
}

function enabledLevels() {
  const raw = (process.env.CONSOLE_RELAY_LEVELS || 'error').toLowerCase();
  const set = new Set();
  for (const tok of raw.split(/[\s,]+/)) {
    const t = tok.trim();
    if (!t) continue;
    if (t === 'all') { set.add('error'); set.add('warn'); set.add('log'); continue; }
    if (t === 'error' || t === 'warn' || t === 'log') set.add(t);
  }
  if (set.size === 0) set.add('error');
  return set;
}

// Install a relay that forwards console output to a Discord channel/owner DMs.
// Controlled by env:
//  - ERROR_LOG_CHANNEL_ID: destination channel
//  - CONSOLE_RELAY_LEVELS: comma/space list: error,warn,log,all (default: error)
function install(client) {
  const channelId = process.env.ERROR_LOG_CHANNEL_ID;
  const owners = parseOwnerIds();
  if (!channelId && !owners.length) return; // nothing to send to

  const levels = enabledLevels();
  const originals = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    log: console.log.bind(console),
  };

  const buffers = { error: [], warn: [], log: [] };
  const timers = { error: null, warn: null, log: null };
  const sending = { error: false, warn: false, log: false };
  const flushDelay = 2000; // batch messages for 2s

  async function sendLines(level, lines) {
    if (!lines.length) return;
    const prefix = `[${new Date().toISOString()}] console.${level}`;
    const text = `${prefix}\n${lines.join('\n')}`;
    const chunks = chunkString(text, 1800); // leave room for code fences
    for (const chunk of chunks) {
      const content = '```\n' + chunk + '\n```';
      if (channelId) {
        try {
          const ch = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
          if (ch && ch.isTextBased?.()) {
            await ch.send({ content });
            continue;
          }
        } catch (_) { /* fall through to owners */ }
      }
      for (const id of owners) {
        try {
          const u = await client.users.fetch(id);
          await u.send({ content });
        } catch (_) { /* ignore DM failures */ }
      }
    }
  }

  function scheduleFlush(level) {
    if (timers[level]) return;
    timers[level] = setTimeout(async () => {
      const lines = buffers[level];
      buffers[level] = [];
      timers[level] = null;
      try {
        sending[level] = true;
        await sendLines(level, lines);
      } finally {
        sending[level] = false;
      }
    }, flushDelay);
    if (typeof timers[level].unref === 'function') timers[level].unref();
  }

  function makeRelay(level) {
    const original = originals[level];
    return function(...args) {
      try {
        original(...args);
        if (!levels.has(level)) return; // not enabled
        const line = args.map(formatArg).join(' ');
        buffers[level].push(line);
        const totalLen = buffers[level].reduce((n, s) => n + s.length, 0);
        if (totalLen > 3500 || buffers[level].length > 10) {
          if (timers[level]) { clearTimeout(timers[level]); timers[level] = null; }
          (async () => {
            const lines = buffers[level]; buffers[level] = [];
            try { sending[level] = true; await sendLines(level, lines); } finally { sending[level] = false; }
          })();
        } else {
          scheduleFlush(level);
        }
      } catch (_) {
        try { originals.error('[errorConsoleRelay] failed to relay console.' + level); } catch {}
      }
    };
  }

  // Attach relays per enabled level
  if (levels.has('error')) console.error = makeRelay('error');
  if (levels.has('warn')) console.warn = makeRelay('warn');
  if (levels.has('log')) console.log = makeRelay('log');
}

module.exports = { install };
