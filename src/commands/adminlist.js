const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');

function isOwner(userId) {
  const raw = process.env.BOT_OWNER_IDS || '';
  const ids = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  return ids.includes(String(userId));
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adminlist')
    .setDescription('Owner-only: list guilds where a user has Administrator')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to check').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('max')
        .setDescription('Max guilds to list (default 25, max 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'This command is restricted to bot owners.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser('user', true);
    const max = interaction.options.getInteger('max') ?? 25;

    const client = interaction.client;
    const adminGuilds = [];
    const errors = [];

    const guilds = Array.from(client.guilds.cache.values());
    for (const guild of guilds) {
      try {
        let member = guild.members.cache.get(user.id);
        if (!member) {
          member = await guild.members.fetch(user.id);
        }
        if (member && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          adminGuilds.push(`${guild.name} (${guild.id})`);
        }
      } catch (err) {
        if (err && err.code && err.code !== 10007) {
          errors.push(`${guild.name}: ${err.message || err.code}`);
        }
      }
      await sleep(150);
    }

    const embed = new EmbedBuilder()
      .setTitle('Admin Guilds Report')
      .setColor(0x0000ff)
      .addFields(
        { name: 'User', value: `${user.tag} (${user.id})`, inline: false },
        { name: 'Total admin guilds (mutual)', value: String(adminGuilds.length), inline: true },
        { name: 'Total scanned', value: String(guilds.length), inline: true },
      )
      .setTimestamp(new Date());

    if (adminGuilds.length) {
      const list = adminGuilds.slice(0, max).join('\n');
      embed.addFields({ name: `Guilds (showing up to ${max})`, value: list });
      if (adminGuilds.length > max) {
        embed.addFields({ name: 'Note', value: `+${adminGuilds.length - max} more not shown` });
      }
    } else {
      embed.addFields({ name: 'Guilds', value: 'None found among mutual guilds.' });
    }

    if (errors.length) {
      embed.addFields({ name: 'Fetch notes', value: errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n…and ${errors.length - 5} more` : '') });
    }

    return interaction.editReply({ embeds: [embed] });
  },
};

