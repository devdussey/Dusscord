const fs = require('fs');
const path = require('path');

function loadEvents(client) {
    const eventsPath = path.join(__dirname, '..', 'events');

    if (!fs.existsSync(eventsPath)) {
        console.log('Events directory not found, creating...');
        fs.mkdirSync(eventsPath, { recursive: true });
        return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        let event;

        try {
            event = require(filePath);
        } catch (error) {
            console.error(`Failed to load event ${file}:`, error);
            continue;
        }

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }

        console.log(`✓ Loaded event: ${event.name}`);
    }
}

module.exports = { loadEvents };

