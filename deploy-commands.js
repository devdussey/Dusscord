const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const env = (process.env.NODE_ENV || '').trim().toLowerCase();
        const clientId = process.env.CLIENT_ID;
        const guildIds = (process.env.GUILD_IDS || process.env.GUILD_ID || '')
            .split(/[\s,]+/)
            .map(s => s.trim())
            .filter(Boolean);

        if (env === 'development' && guildIds.length > 0) {
            // Deploy to one or more guilds for faster iteration
            for (const gid of guildIds) {
                const data = await rest.put(
                    Routes.applicationGuildCommands(clientId, gid),
                    { body: commands },
                );
                console.log(`Successfully reloaded ${data.length} guild application (/) commands for guild ${gid}.`);
            }
        } else {
            // Deploy globally
            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands },
            );
            console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
        }
    } catch (error) {
        console.error('Error deploying commands:', error);
    }
})();
