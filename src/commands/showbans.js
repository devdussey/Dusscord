const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const banStore = require('../utils/banStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('showbans')
    .setDescription('List current bans in this server and cache them for cross-server checks.'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: 'You need the Ban Members permission to use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const me = interaction.guild.members.me;
    if (!me?.permissions?.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.editReply({ content: 'I need the Ban Members permission to read ban data.' });
    }

    let bans;
    try {
      bans = await interaction.guild.bans.fetch();
    } catch (err) {
      return interaction.editReply({ content: `Failed to fetch bans: ${err.message || 'Unknown error'}` });
    }

    const records = bans.map(ban => ({
      userId: ban.user.id,
      reason: ban.reason || null,
      tag: typeof ban.user.tag === 'string' ? ban.user.tag : null,
    }));

    banStore.setGuildBans(interaction.guild.id, interaction.guild.name, records);

    if (!records.length) {
      return interaction.editReply({ content: 'No members are currently banned.' });
    }

    const limit = 25;
    const first = records.slice(0, limit);
    const lines = first.map((ban, index) => {
      const tag = ban.tag || `Unknown (${ban.userId})`;
      const reason = ban.reason ? ban.reason.slice(0, 200) : 'No reason provided';
      return `${index + 1}. ${tag} — ${reason}`;
    });

    const extra = records.length > limit ? `\n…and ${records.length - limit} more.` : '';
    const embed = new EmbedBuilder()
      .setTitle(`Banned members in ${interaction.guild.name}`)
      .setDescription(`${lines.join('\n')}${extra}`)
      .setColor(0xff0000)
      .setFooter({ text: `Synced ${records.length} ban(s)` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
