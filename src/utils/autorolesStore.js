const fs = require('fs');
const { ensureFileSync, resolveDataPath, writeJsonSync } = require('./dataDir');

const STORE_FILE = 'autoroles.json';

function getDataFile() {
    return resolveDataPath(STORE_FILE);
}

let cache = null;

function ensureLoaded() {
    if (!cache) {
        try {
            ensureFileSync(STORE_FILE, '{}');
            const raw = fs.readFileSync(getDataFile(), 'utf8');
            cache = raw ? JSON.parse(raw) : {};
            if (!cache || typeof cache !== 'object') cache = {};
        } catch (e) {
            console.error('Failed to load autoroles store:', e);
            cache = {};
        }
    }
}

function save() {
    const safe = cache && typeof cache === 'object' ? cache : {};
    writeJsonSync(STORE_FILE, safe);
}

function getGuildRoles(guildId) {
    ensureLoaded();
    return Array.isArray(cache[guildId]) ? cache[guildId] : [];
}

function setGuildRoles(guildId, roleIds) {
    ensureLoaded();
    cache[guildId] = Array.from(new Set(roleIds));
    save();
}

function addGuildRole(guildId, roleId) {
    const current = getGuildRoles(guildId);
    if (!current.includes(roleId)) {
        current.push(roleId);
        setGuildRoles(guildId, current);
        return true;
    }
    return false;
}

function removeGuildRole(guildId, roleId) {
    const current = getGuildRoles(guildId);
    const next = current.filter(id => id !== roleId);
    setGuildRoles(guildId, next);
    return next.length !== current.length;
}

function clearGuildRoles(guildId) {
    setGuildRoles(guildId, []);
}

module.exports = {
    getGuildRoles,
    setGuildRoles,
    addGuildRole,
    removeGuildRole,
    clearGuildRoles,
};

