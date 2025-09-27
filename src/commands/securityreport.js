const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const eventsStore = require('../utils/securityEventsStore');
const { resolveEmbedColour } = require('../utils/guildColourStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('securityreport')
    .setDescription('Report users triggering permission/hierarchy/missing-command events')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Filter by event type')
        .addChoices(
          { name: 'Any', value: 'any' },
          { name: 'Permission denied', value: 'perm_denied' },
          { name: 'Hierarchy blocked', value: 'hierarchy_block' },
          { name: 'Missing command', value: 'missing_cmd' },
        )
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('days')
        .setDescription('Lookback window (days, default 7)')
        .setMinValue(1)
        .setMaxValue(90)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const type = interaction.options.getString('type') || 'any';
    const days = interaction.options.getInteger('days') ?? 7;
    const sinceMs = days * 24 * 60 * 60 * 1000;
    const rows = await eventsStore.getSummary({ guildId: interaction.guildId, type: type === 'any' ? null : type, sinceMs });

    if (!rows.length) {
      return interaction.editReply({ content: `No events found in the past ${days} day(s).` });
    }

    const top = rows.slice(0, 15);
    const lines = top.map((r, idx) => {
      const tag = r.tag && r.userId ? `${r.tag} (<@${r.userId}>)` : 'Unknown';
      const reasons = r.reasons.length ? ` — ${r.reasons.join('; ').slice(0, 120)}` : '';
      return `${idx + 1}. ${tag} • ${r.count} event(s)${reasons}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('Security Report')
      .setColor(resolveEmbedColour(interaction.guildId, 0x0000ff))
      .setDescription(lines.join('\n'))
      .setFooter({ text: `Type: ${type} • Window: ${days}d • Total unique: ${rows.length}` })
      .setTimestamp(new Date());

    return interaction.editReply({ embeds: [embed] });
  },
};

