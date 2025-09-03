// Lists Discord application commands (global and/or guild) for verification
// Usage:
//   node scripts/list-commands.js            -> lists global commands
//   node scripts/list-commands.js guild      -> lists guild commands (requires GUILD_ID)
//   node scripts/list-commands.js both       -> lists both

const { REST, Routes } = require('discord.js');
require('dotenv').config();

async function run() {
  const args = process.argv.slice(2);
  const scopeArg = args.find(a => !a.startsWith('-'));
  const scope = (scopeArg || 'global').toLowerCase();
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId) {
    console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment.');
    process.exit(1);
  }

  const rest = new REST().setToken(token);

  try {
    if (scope === 'global' || scope === 'both') {
      const global = await rest.get(Routes.applicationCommands(clientId));
      console.log('GLOBAL COMMANDS:');
      for (const c of global) {
        console.log(`- ${c.name} (${c.id})`);
      }
    }

    if (scope === 'guild' || scope === 'both') {
      if (!guildId) {
        console.error('GUILD_ID is required to list guild commands.');
        process.exit(1);
      }
      const guild = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
      console.log(`GUILD COMMANDS (${guildId}):`);
      for (const c of guild) {
        console.log(`- ${c.name} (${c.id})`);
      }
    }
  } catch (err) {
    console.error('Failed to list commands:', err);
    process.exit(1);
  }
}

run();
