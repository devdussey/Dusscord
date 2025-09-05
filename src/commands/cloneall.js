const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../utils/securityLogger');

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

function sanitizeName(name, prefix = '', suffix = '') {
  const base = `${prefix || ''}${name || 'emoji'}${suffix || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_');
  return (base || 'emoji').slice(0, 32);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cloneall')
    .setDescription('Clone emojis from another server into this server')
    .addStringOption(opt =>
      opt.setName('source_guild_id')
        .setDescription('ID of the server to copy from (bot must be in it)')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Which emojis to clone')
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Static only', value: 'static' },
          { name: 'Animated only', value: 'animated' },
        )
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('Max emojis to clone (default: all available)')
        .setMinValue(1)
        .setMaxValue(200)
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('prefix')
        .setDescription('Name prefix for new emojis')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('suffix')
        .setDescription('Name suffix for new emojis')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('skip_duplicates')
        .setDescription('Skip if an emoji with the same name exists (default: true)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
      try { await logger.logPermissionDenied(interaction, 'cloneall', 'Bot missing Manage Emojis and Stickers'); } catch (err) { console.error('src/commands/cloneall.js', err); }
      return interaction.reply({ content: 'I need the Manage Emojis and Stickers permission.', ephemeral: true });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
      try { await logger.logPermissionDenied(interaction, 'cloneall', 'User missing Manage Emojis and Stickers'); } catch (err) { console.error('src/commands/cloneall.js', err); }
      return interaction.reply({ content: 'You need Manage Emojis and Stickers to use this command.', ephemeral: true });
    }

    const sourceId = interaction.options.getString('source_guild_id', true);
    const type = interaction.options.getString('type') || 'all';
    const limitOpt = interaction.options.getInteger('limit');
    const prefix = interaction.options.getString('prefix') || '';
    const suffix = interaction.options.getString('suffix') || '';
    const skipDupOpt = interaction.options.getBoolean('skip_duplicates');
    const skipDuplicates = skipDupOpt === null ? true : !!skipDupOpt;

    await interaction.deferReply({ ephemeral: true });

    let sourceGuild = interaction.client.guilds.cache.get(sourceId);
    if (!sourceGuild) {
      try { sourceGuild = await interaction.client.guilds.fetch(sourceId); } catch (err) { console.error('src/commands/cloneall.js', err); }
    }
    if (!sourceGuild) {
      return interaction.editReply({ content: 'I am not in that server or the ID is invalid.' });
    }

    // Collect source emojis
    let emojis = Array.from(sourceGuild.emojis.cache.values());
    if (type === 'static') emojis = emojis.filter(e => !e.animated);
    if (type === 'animated') emojis = emojis.filter(e => e.animated);
    if (limitOpt) emojis = emojis.slice(0, limitOpt);
    if (!emojis.length) {
      return interaction.editReply({ content: 'No emojis to clone from the source server with the selected filter.' });
    }

    const existingNames = new Set(interaction.guild.emojis.cache.map(e => e.name));

    let created = 0, skipped = 0, failed = 0, stoppedOnLimit = false;
    for (const e of emojis) {
      const newName = sanitizeName(e.name, prefix, suffix);
      if (skipDuplicates && existingNames.has(newName)) {
        skipped++;
        continue;
      }
      try {
        const createdEmoji = await interaction.guild.emojis.create({ attachment: e.url, name: newName });
        existingNames.add(createdEmoji.name);
        created++;
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('maximum number of emojis')) {
          stoppedOnLimit = true;
          break;
        }
        failed++;
      }
      await sleep(500);
    }

    let summary = `Clone summary from ${sourceGuild.name} (${sourceGuild.id})\n` +
      `Created: ${created}\nSkipped: ${skipped}\nFailed: ${failed}`;
    if (stoppedOnLimit) summary += `\nStopped: server emoji limit reached.`;
    return interaction.editReply({ content: summary });
  },
};

