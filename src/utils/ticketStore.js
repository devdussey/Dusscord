const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'tickets.json';

function getDataFile() {
  return resolveDataPath(STORE_FILE);
}

let cache = null;

function sanitisePanel(panel) {
  if (!panel || typeof panel !== 'object') return null;
  const cleaned = { ...panel };
  cleaned.id = String(cleaned.id || '');
  cleaned.name = String(cleaned.name || '').slice(0, 100);
  cleaned.ticketType = cleaned.ticketType === 'thread' ? 'thread' : 'channel';
  cleaned.component = cleaned.component && typeof cleaned.component === 'object' ? { ...cleaned.component } : { type: 'button', label: 'Create Ticket' };
  if (cleaned.component.type === 'menu') {
    const opts = Array.isArray(cleaned.component.options) ? cleaned.component.options : [];
    cleaned.component.options = opts.slice(0, 25).map((opt, idx) => ({
      value: String(opt?.value || `option-${idx}` ).slice(0, 100),
      label: String(opt?.label || opt?.value || `Option ${idx + 1}`).slice(0, 100),
      description: opt?.description ? String(opt.description).slice(0, 100) : undefined,
      emoji: opt?.emoji && typeof opt.emoji === 'string' ? opt.emoji.slice(0, 50) : undefined,
    })).filter(opt => opt.value && opt.label);
    if (!cleaned.component.options.length) {
      cleaned.component = { type: 'button', label: 'Create Ticket' };
    }
    cleaned.component.placeholder = cleaned.component.placeholder ? String(cleaned.component.placeholder).slice(0, 100) : 'Choose a ticket type';
  } else {
    cleaned.component = {
      type: 'button',
      label: String(cleaned.component.label || 'Create Ticket').slice(0, 80),
      style: cleaned.component.style || 'primary',
    };
  }
  cleaned.embed = cleaned.embed && typeof cleaned.embed === 'object' ? { ...cleaned.embed } : {};
  cleaned.logChannelId = cleaned.logChannelId || null;
  cleaned.archiveChannelId = cleaned.archiveChannelId || null;
  cleaned.ticketParentId = cleaned.ticketParentId || null;
  cleaned.nextTicketNumber = Number.isInteger(cleaned.nextTicketNumber) && cleaned.nextTicketNumber > 0 ? cleaned.nextTicketNumber : 1;
  cleaned.createdAt = cleaned.createdAt || Date.now();
  return cleaned;
}

function sanitiseTicket(ticket) {
  if (!ticket || typeof ticket !== 'object') return null;
  const cleaned = { ...ticket };
  cleaned.id = String(cleaned.id || '');
  cleaned.panelId = String(cleaned.panelId || '');
  cleaned.userId = String(cleaned.userId || '');
  cleaned.channelId = cleaned.channelId ? String(cleaned.channelId) : null;
  cleaned.threadId = cleaned.threadId ? String(cleaned.threadId) : null;
  cleaned.status = cleaned.status === 'closed' ? 'closed' : 'open';
  cleaned.reason = cleaned.reason ? String(cleaned.reason).slice(0, 200) : null;
  cleaned.createdAt = cleaned.createdAt || Date.now();
  cleaned.closedAt = cleaned.closedAt || null;
  cleaned.claimedBy = cleaned.claimedBy ? String(cleaned.claimedBy) : null;
  cleaned.claimedAt = cleaned.claimedAt || null;
  cleaned.logMessageId = cleaned.logMessageId || null;
  cleaned.controlMessageId = cleaned.controlMessageId || null;
  cleaned.ticketNumber = Number.isInteger(cleaned.ticketNumber) ? cleaned.ticketNumber : 0;
  return cleaned;
}

function ensureLoaded() {
  if (cache) return;
  try {
    ensureFileSync(STORE_FILE, JSON.stringify({ guilds: {} }, null, 2));
    const raw = fs.readFileSync(getDataFile(), 'utf8');
    cache = raw ? JSON.parse(raw) : { guilds: {} };
    if (!cache || typeof cache !== 'object') cache = { guilds: {} };
    if (!cache.guilds || typeof cache.guilds !== 'object') cache.guilds = {};
  } catch (err) {
    console.error('Failed to load ticket store:', err);
    cache = { guilds: {} };
  }
}

function persist() {
  const safe = cache && typeof cache === 'object' ? cache : { guilds: {} };
  writeJsonSync(STORE_FILE, safe);
}

function ensureGuild(guildId) {
  ensureLoaded();
  const id = String(guildId);
  if (!cache.guilds[id]) {
    cache.guilds[id] = {
      config: {
        supportRoleIds: [],
        archiveChannelId: null,
        logChannelId: null,
        maxTicketsPerUser: 2,
      },
      panels: {},
      openTickets: {},
      nextPanelId: 1,
      nextTicketId: 1,
    };
  }
  const guild = cache.guilds[id];
  if (!guild.config || typeof guild.config !== 'object') {
    guild.config = { supportRoleIds: [], archiveChannelId: null, logChannelId: null, maxTicketsPerUser: 2 };
  }
  if (!Array.isArray(guild.config.supportRoleIds)) guild.config.supportRoleIds = [];
  if (!guild.panels || typeof guild.panels !== 'object') guild.panels = {};
  if (!guild.openTickets || typeof guild.openTickets !== 'object') guild.openTickets = {};
  if (!Number.isInteger(guild.nextPanelId) || guild.nextPanelId < 1) guild.nextPanelId = 1;
  if (!Number.isInteger(guild.nextTicketId) || guild.nextTicketId < 1) guild.nextTicketId = 1;
  return guild;
}

function getConfig(guildId) {
  const guild = ensureGuild(guildId);
  return { ...guild.config, supportRoleIds: guild.config.supportRoleIds.slice() };
}

function setConfig(guildId, config) {
  const guild = ensureGuild(guildId);
  const supportRoleIds = Array.isArray(config?.supportRoleIds)
    ? config.supportRoleIds.map(id => String(id)).filter(Boolean)
    : guild.config.supportRoleIds;
  const archiveChannelId = config?.archiveChannelId ? String(config.archiveChannelId) : (config?.archiveChannelId === null ? null : guild.config.archiveChannelId || null);
  const logChannelId = config?.logChannelId ? String(config.logChannelId) : (config?.logChannelId === null ? null : guild.config.logChannelId || null);
  const maxTicketsPerUser = Number.isInteger(config?.maxTicketsPerUser) && config.maxTicketsPerUser > 0 ? config.maxTicketsPerUser : guild.config.maxTicketsPerUser || 2;
  guild.config = { supportRoleIds, archiveChannelId, logChannelId, maxTicketsPerUser };
  persist();
  return getConfig(guildId);
}

function addPanel(guildId, panel) {
  const guild = ensureGuild(guildId);
  const id = String(guild.nextPanelId++);
  const stored = sanitisePanel({ ...panel, id });
  guild.panels[id] = stored;
  persist();
  return stored;
}

function updatePanel(guildId, panelId, updates) {
  const guild = ensureGuild(guildId);
  const panel = guild.panels[String(panelId)];
  if (!panel) return null;
  const merged = sanitisePanel({ ...panel, ...updates, id: panel.id, nextTicketNumber: updates?.nextTicketNumber ?? panel.nextTicketNumber });
  guild.panels[String(panelId)] = merged;
  persist();
  return merged;
}

function removePanel(guildId, panelId) {
  const guild = ensureGuild(guildId);
  const key = String(panelId);
  if (!guild.panels[key]) return false;
  delete guild.panels[key];
  persist();
  return true;
}

function listPanels(guildId) {
  const guild = ensureGuild(guildId);
  return Object.values(guild.panels).map(sanitisePanel);
}

function getPanel(guildId, panelId) {
  const guild = ensureGuild(guildId);
  const panel = guild.panels[String(panelId)];
  return panel ? sanitisePanel(panel) : null;
}

function getPanelByName(guildId, name) {
  const guild = ensureGuild(guildId);
  const entry = Object.values(guild.panels).find(p => (p.name || '').toLowerCase() === String(name || '').toLowerCase());
  return entry ? sanitisePanel(entry) : null;
}

function createTicket(guildId, ticket) {
  const guild = ensureGuild(guildId);
  const id = String(guild.nextTicketId++);
  const panel = guild.panels[String(ticket.panelId)];
  if (panel) {
    panel.nextTicketNumber = (panel.nextTicketNumber || 1);
  }
  const ticketNumber = panel ? panel.nextTicketNumber++ : guild.nextTicketId;
  const stored = sanitiseTicket({ ...ticket, id, ticketNumber, status: 'open' });
  guild.openTickets[id] = stored;
  if (panel) guild.panels[panel.id] = sanitisePanel(panel);
  persist();
  return stored;
}

function setTicketControlMessage(guildId, ticketId, messageId) {
  const guild = ensureGuild(guildId);
  const ticket = guild.openTickets[String(ticketId)];
  if (!ticket) return null;
  ticket.controlMessageId = messageId ? String(messageId) : null;
  persist();
  return sanitiseTicket(ticket);
}

function markTicketClaimed(guildId, ticketId, userId) {
  const guild = ensureGuild(guildId);
  const ticket = guild.openTickets[String(ticketId)];
  if (!ticket) return null;
  ticket.claimedBy = userId ? String(userId) : null;
  ticket.claimedAt = userId ? Date.now() : null;
  persist();
  return sanitiseTicket(ticket);
}

function closeTicket(guildId, ticketId) {
  const guild = ensureGuild(guildId);
  const key = String(ticketId);
  const ticket = guild.openTickets[key];
  if (!ticket) return null;
  ticket.status = 'closed';
  ticket.closedAt = Date.now();
  const closed = sanitiseTicket(ticket);
  delete guild.openTickets[key];
  persist();
  return closed;
}

function countOpenTicketsForUser(guildId, userId) {
  const guild = ensureGuild(guildId);
  const uid = String(userId);
  return Object.values(guild.openTickets).filter(t => t.userId === uid && t.status !== 'closed').length;
}

function findOpenTicketByChannel(guildId, channelId) {
  const guild = ensureGuild(guildId);
  const cid = String(channelId);
  const ticket = Object.values(guild.openTickets).find(t => t.channelId === cid || t.threadId === cid);
  return ticket ? sanitiseTicket(ticket) : null;
}

function getTicket(guildId, ticketId) {
  const guild = ensureGuild(guildId);
  const ticket = guild.openTickets[String(ticketId)];
  return ticket ? sanitiseTicket(ticket) : null;
}

module.exports = {
  getConfig,
  setConfig,
  addPanel,
  updatePanel,
  removePanel,
  listPanels,
  getPanel,
  getPanelByName,
  createTicket,
  setTicketControlMessage,
  markTicketClaimed,
  closeTicket,
  countOpenTicketsForUser,
  findOpenTicketByChannel,
  getTicket,
};
