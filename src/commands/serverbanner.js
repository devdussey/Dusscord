const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverbanner')
    .setDescription("Display this server's banner")
    .setDMPermission(false),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
      return;
    }

    const banner = guild.bannerURL({ size: 4096 });
    if (!banner) {
      await interaction.reply({ content: 'This server does not have a banner configured.', ephemeral: true });
      return;
    }

    const animated = Boolean(guild.banner && guild.banner.startsWith('a_'));
    const formats = animated ? ['gif', 'png', 'jpeg', 'webp'] : ['png', 'jpeg', 'webp'];
    const links = formats
      .map(fmt => `[${fmt.toUpperCase()}](${guild.bannerURL({ size: 4096, extension: fmt })})`)
      .join(' • ');

    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} server banner`)
      .setDescription(links)
      .setImage(banner)
      .setColor(0x5865F2)
      .setTimestamp(Date.now());

    await interaction.reply({ embeds: [embed] });
  },
};

