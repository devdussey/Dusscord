// Utility to clear Discord application commands (global and/or guild).
// Usage:
//   node scripts/clean-commands.js            -> clears global commands
//   node scripts/clean-commands.js guild      -> clears guild commands (requires GUILD_ID)
//   node scripts/clean-commands.js both       -> clears both global and guild commands

const { REST, Routes } = require('discord.js');
require('dotenv').config();

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || process.env.DRY_RUN === '1';
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
      if (isDryRun) {
        console.log('[DRY-RUN] Would clear GLOBAL application commands.');
      } else {
        console.log('Clearing GLOBAL application commands...');
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('Global commands cleared.');
      }
    }

    if (scope === 'guild' || scope === 'both') {
      if (!guildId) {
        console.error('GUILD_ID is required to clear guild commands.');
        process.exit(1);
      }
      if (isDryRun) {
        console.log(`[DRY-RUN] Would clear GUILD (${guildId}) application commands.`);
      } else {
        console.log(`Clearing GUILD (${guildId}) application commands...`);
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log('Guild commands cleared.');
      }
    }

    console.log(isDryRun ? 'Dry-run complete.' : 'Done.');
  } catch (err) {
    console.error('Failed to clear commands:', err);
    process.exit(1);
  }
}

run();
