const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } = require('discord.js');
const { createEmbedModal } = require('../utils/embedBuilder');
const welcomeStore = require('../utils/welcomeStore');
const { applyDefaultColour } = require('../utils/guildColourStore');

function buildEmbedFromFields(fields, guildId) {
  const title = fields.getTextInputValue('embedTitle');
  const description = fields.getTextInputValue('embedDescription');
  const color = fields.getTextInputValue('embedColor');
  const image = fields.getTextInputValue('embedImage');
  const footer = fields.getTextInputValue('embedFooter');
  const embed = new EmbedBuilder();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (image) embed.setImage(image);
  if (footer) embed.setFooter({ text: footer });
  // Prefer guild default colour; if user specified a colour string, try to apply it as fallback
  try { applyDefaultColour(embed, guildId); } catch (_) {}
  if (color) {
    try { embed.setColor(color); } catch (_) {}
  }
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure a welcome embed for new members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Open the embed builder and save the result as the welcome message')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post welcomes (required)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(sub => sub.setName('status').setDescription('Show current welcome configuration'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable welcome messages'))
    .addSubcommand(sub =>
      sub.setName('test')
        .setDescription('Send a test welcome message now')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('channel', true);
      const modal = createEmbedModal({ customId: `welcome:embed:${channel.id}`, title: 'Welcome Embed Builder' });
      return interaction.showModal(modal);
    }

    if (sub === 'status') {
      const cfg = welcomeStore.get(interaction.guildId);
      if (!cfg) return interaction.reply({ content: 'Welcome is not configured.', ephemeral: true });
      return interaction.reply({ content: `Welcome configured for <#${cfg.channelId}>.`, ephemeral: true });
    }

    if (sub === 'disable') {
      const existed = welcomeStore.clear(interaction.guildId);
      return interaction.reply({ content: existed ? 'Welcome disabled.' : 'Welcome was not configured.', ephemeral: true });
    }

    if (sub === 'test') {
      const cfg = welcomeStore.get(interaction.guildId);
      if (!cfg) return interaction.reply({ content: 'Welcome is not configured.', ephemeral: true });
      const channel = await interaction.guild.channels.fetch(cfg.channelId).catch(() => null);
      if (!channel) return interaction.reply({ content: 'Saved channel not found. Re-run setup.', ephemeral: true });
      const preview = EmbedBuilder.from(cfg.embed);
      try { await channel.send({ content: `Welcome, ${interaction.user}!`, embeds: [preview] }); } catch (_) {}
      return interaction.reply({ content: `Sent a test welcome to ${channel}.`, ephemeral: true });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};

