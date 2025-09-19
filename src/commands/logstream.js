const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } = require('discord.js');
const store = require('../utils/streamLogStore');

const CATEGORY_CHOICES = [
  { name: 'Messages', value: 'messages' },
  { name: 'Invites', value: 'invites' },
  { name: 'Reactions', value: 'reactions' },
  { name: 'Roles', value: 'roles' },
  { name: 'Users', value: 'users' },
  { name: 'Server', value: 'server' },
  { name: 'Channels', value: 'channels' },
  { name: 'Bot', value: 'bot' },
  { name: 'Verification', value: 'verification' },
  { name: 'Security', value: 'security' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logstream')
    .setDescription('Configure streamable server log events')
    .addSubcommand(sub =>
      sub.setName('setchannel')
        .setDescription('Set the channel where stream logs are sent')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Target text or announcement channel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('Enable or disable a category')
        .addStringOption(opt => opt.setName('category').setDescription('Log category').addChoices(...CATEGORY_CHOICES).setRequired(true))
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable (true) or disable (false)').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('show')
        .setDescription('Show current stream logging configuration')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.editReply({ content: 'You need Manage Server to configure this.' });
    }

    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;
    if (sub === 'setchannel') {
      const ch = interaction.options.getChannel('channel', true);
      await store.setChannel(gid, ch.id);
      return interaction.editReply({ content: `Stream logs channel set to ${ch}.` });
    }
    if (sub === 'toggle') {
      const category = interaction.options.getString('category', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      try {
        await store.setEnabled(gid, category, enabled);
      } catch (err) {
        return interaction.editReply({ content: 'Unknown category.' });
      }
      return interaction.editReply({ content: `${category} is now ${enabled ? 'enabled' : 'disabled'}.` });
    }
    if (sub === 'show') {
      const { channelId, categories } = await store.listStatuses(gid);
      const embed = new EmbedBuilder().setTitle('Stream Log Configuration');
      try {
        const { applyDefaultColour } = require('../utils/guildColourStore');
        applyDefaultColour(embed, gid);
      } catch (_) {}
      embed.addFields({ name: 'Channel', value: channelId ? `<#${channelId}> (${channelId})` : 'Not set', inline: false });
      for (const [k, v] of Object.entries(categories)) {
        embed.addFields({ name: k, value: v ? '✅ Enabled' : '❌ Disabled', inline: true });
      }
      return interaction.editReply({ embeds: [embed] });
    }
    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};

