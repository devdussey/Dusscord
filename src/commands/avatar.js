const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { resolveEmbedColour } = require('../utils/guildColourStore');

function buildAvatarLinks(user) {
  const size = 4096;
  const animated = Boolean(user.avatar && user.avatar.startsWith('a_'));
  const formats = animated ? ['gif', 'png', 'jpeg', 'webp'] : ['png', 'jpeg', 'webp'];
  return formats
    .map(fmt => {
      const url = user.displayAvatarURL({ size, extension: fmt, forceStatic: fmt === 'gif' ? false : true });
      const label = fmt.toUpperCase();
      return `[${label}](${url})`;
    })
    .join(' • ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription("Display a user's avatar")
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('User to lookup (defaults to you)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const links = buildAvatarLinks(target);
    const displayUrl = target.displayAvatarURL({ size: 4096, extension: target.avatar?.startsWith('a_') ? 'gif' : 'png' });

    const embed = new EmbedBuilder()
      .setTitle(`${target.tag || target.username}'s avatar`)
      .setDescription(links)
      .setImage(displayUrl)
      .setColor(resolveEmbedColour(interaction.guildId, 0x5865F2))
      .setFooter({ text: `Requested by ${interaction.user.tag || interaction.user.username}` })
      .setTimestamp(Date.now());

    await interaction.reply({ embeds: [embed] });
  },
};

