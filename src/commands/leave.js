const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { createEmbedModal } = require('../utils/embedBuilder');
const leaveStore = require('../utils/leaveStore');

function applyPlaceholders(text, context) {
  return String(text || '')
    .replaceAll('{user}', context.userTag)
    .replaceAll('{mention}', context.mention)
    .replaceAll('{guild}', context.guildName)
    .replaceAll('{memberCount}', context.memberCount);
}

function buildEmbedPreview(embedJson, context) {
  const embed = embedJson ? EmbedBuilder.from(embedJson) : new EmbedBuilder();
  const data = embed.toJSON();
  if (data.title) embed.setTitle(applyPlaceholders(data.title, context));
  if (data.description) embed.setDescription(applyPlaceholders(data.description, context));
  if (data.footer?.text) {
    embed.setFooter({ text: applyPlaceholders(data.footer.text, context), iconURL: data.footer.icon_url || undefined });
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Configure a leave embed for departing members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Open the embed builder and save the result as the leave message')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to post leave messages (required)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) => sub.setName('status').setDescription('Show current leave configuration'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable leave messages'))
    .addSubcommand((sub) => sub.setName('test').setDescription('Send a test leave message now')),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      const modal = createEmbedModal({ customId: `leave:embed:${channel.id}`, title: 'Leave Embed Builder' });
      return interaction.showModal(modal);
    }

    if (sub === 'status') {
      const cfg = leaveStore.get(interaction.guildId);
      if (!cfg) return interaction.reply({ content: 'Leave is not configured.', ephemeral: true });
      return interaction.reply({ content: `Leave configured for <#${cfg.channelId}>.`, ephemeral: true });
    }

    if (sub === 'disable') {
      const existed = leaveStore.clear(interaction.guildId);
      return interaction.reply({ content: existed ? 'Leave disabled.' : 'Leave was not configured.', ephemeral: true });
    }

    if (sub === 'test') {
      const cfg = leaveStore.get(interaction.guildId);
      if (!cfg) {
        return interaction.reply({ content: 'Leave is not configured.', ephemeral: true });
      }
      const channel = await interaction.guild.channels.fetch(cfg.channelId).catch(() => null);
      if (!channel) {
        return interaction.reply({ content: 'Saved channel not found. Re-run setup.', ephemeral: true });
      }
      const context = {
        userTag: interaction.user.tag,
        mention: `<@${interaction.user.id}>`,
        guildName: interaction.guild.name,
        memberCount: `${interaction.guild.memberCount}`,
      };
      const embed = buildEmbedPreview(cfg.embed, context);
      try {
        await channel.send({ content: applyPlaceholders('{user} has left the server.', context), embeds: [embed] });
      } catch (_) {}
      return interaction.reply({ content: `Sent a test leave message to ${channel}.`, ephemeral: true });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};
