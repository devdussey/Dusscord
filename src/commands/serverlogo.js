const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverlogo')
    .setDescription("Display this server's icon")
    .setDMPermission(false),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const icon = guild.iconURL({ size: 4096 });
    if (!icon) {
      await interaction.reply({ content: 'This server does not have an icon set.', ephemeral: true });
      return;
    }

    const animated = Boolean(guild.icon && guild.icon.startsWith('a_'));
    const formats = animated ? ['gif', 'png', 'jpeg', 'webp'] : ['png', 'jpeg', 'webp'];
    const links = formats
      .map(fmt => `[${fmt.toUpperCase()}](${guild.iconURL({ size: 4096, extension: fmt })})`)
      .join(' • ');

    const embed = new EmbedBuilder()
      .setTitle(`${guild.name} server icon`)
      .setDescription(links)
      .setImage(icon)
      .setColor(0x5865F2)
      .setTimestamp(Date.now());

    await interaction.reply({ embeds: [embed] });
  },
};

