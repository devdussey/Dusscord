const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const banStore = require('../utils/banStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bannedfrom')
    .setDescription('Check if a user is banned in other servers where the bot is present.')
    .addUserOption(opt =>
      opt
        .setName('user')
        .setDescription('User to look up')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need the Manage Server permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user', true);
    const bans = banStore.getUserBans(target.id, { excludeGuildId: interaction.guildId });

    if (!bans.length) {
      return interaction.editReply({ content: `${target.tag} is not recorded as banned in other servers that synced with /showbans.` });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Ban history for ${target.tag}`)
      .setColor(0xff0000);

    const lines = bans.map(entry => {
      const guildName = entry.guildName || entry.guildId;
      const reason = entry.reason ? entry.reason.slice(0, 200) : 'No reason provided';
      const synced = entry.syncedAt ? `<t:${Math.floor(entry.syncedAt / 1000)}:R>` : 'Unknown time';
      return `• **${guildName}** — ${reason} (synced ${synced})`;
    });

    embed.setDescription(lines.join('\n'));

    return interaction.editReply({ embeds: [embed] });
  },
};
