const fs = require('fs');
const path = require('path');

function loadCommands(client, commandsPath = path.join(__dirname, '..', 'commands')) {
    if (!fs.existsSync(commandsPath)) {
        console.log('Commands directory not found, creating...');
        fs.mkdirSync(commandsPath, { recursive: true });
        return;
    }

    function getAllFiles(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files = [];
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) files.push(...getAllFiles(p));
            else if (e.isFile() && e.name.endsWith('.js')) files.push(p);
        }
        return files;
    }

    const commandFiles = getAllFiles(commandsPath);

    for (const filePath of commandFiles) {
        let command;
        try {
            command = require(filePath);
        } catch (err) {
            console.log(`⚠ Failed to load command at ${filePath}: ${err.message}`);
            continue;
        }

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✓ Loaded command: ${command.data.name}`);
        } else {
            console.log(`⚠ The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }

    console.log(`Loaded ${client.commands.size} commands.`);
}

module.exports = { loadCommands };
