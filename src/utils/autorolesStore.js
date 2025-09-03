const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'autoroles.json');

let cache = null;

function ensureLoaded() {
    if (!cache) {
        try {
            if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
            if (fs.existsSync(dataFile)) {
                const raw = fs.readFileSync(dataFile, 'utf8');
                cache = JSON.parse(raw);
            } else {
                cache = {};
            }
        } catch (e) {
            cache = {};
        }
    }
}

function save() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify(cache, null, 2), 'utf8');
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

