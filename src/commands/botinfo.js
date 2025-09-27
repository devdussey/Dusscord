const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { resolveEmbedColour } = require('../utils/guildColourStore');

function formatUptime(ms) {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / (60 * 1000)) % 60;
  const hr = Math.floor(ms / (60 * 60 * 1000)) % 24;
  const d = Math.floor(ms / (24 * 60 * 60 * 1000));
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (hr) parts.push(`${hr}h`);
  if (min) parts.push(`${min}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Show which bot instance is responding and environment details'),

  async execute(interaction) {
    const client = interaction.client;
    const user = client.user;
    const mode = process.env.NODE_ENV || 'production';
    const appId = process.env.CLIENT_ID || 'unknown';
    const guildDeploy = mode === 'development' && process.env.GUILD_ID ? `Guild-scoped to ${process.env.GUILD_ID}` : 'Global commands';
    const uptime = formatUptime(process.uptime() * 1000);

    const embed = new EmbedBuilder()
      .setTitle('Bot Info')
      .setColor(resolveEmbedColour(interaction.guildId, 0x0000ff))
      .addFields(
        { name: 'Bot', value: `${user.tag} (${user.id})`, inline: false },
        { name: 'Application ID', value: appId, inline: false },
        { name: 'Mode', value: mode, inline: true },
        { name: 'Deploy', value: guildDeploy, inline: true },
        { name: 'Commands Loaded', value: String(client.commands?.size ?? 0), inline: true },
        { name: 'Uptime', value: uptime, inline: true },
      )
      .setThumbnail(user.displayAvatarURL());

    try {
      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      // Fallback if interaction expired
      if (interaction.channel?.send) {
        await interaction.channel.send({ content: `Bot info for <@${interaction.user.id}>:`, embeds: [embed] });
      }
    }
  },
};

