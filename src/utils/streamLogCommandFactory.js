const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const streamLogStore = require('./streamLogStore');

function buildSetCommand({ commandName, description, category, label }) {
  if (!commandName || !category) {
    throw new Error('commandName and category are required for buildSetCommand');
  }

  const data = new SlashCommandBuilder()
    .setName(commandName)
    .setDescription(description || `Set the ${label || category} stream log channel`)
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Target text or announcement channel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true),
    );

  return {
    data,
    async execute(interaction) {
      if (!interaction.inGuild()) {
        return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.editReply({ content: 'You need Manage Server to configure this.' });
      }

      const channel = interaction.options.getChannel('channel', true);
      try {
        await streamLogStore.setChannel(interaction.guildId, channel.id, category);
      } catch (err) {
        return interaction.editReply({ content: 'Failed to update the log channel.' });
      }

      const humanLabel = label || category;
      return interaction.editReply({ content: `${humanLabel} stream logs channel set to ${channel}.` });
    },
  };
}

function buildModeCommand({ commandName, description, category, label }) {
  if (!commandName || !category) {
    throw new Error('commandName and category are required for buildModeCommand');
  }

  const data = new SlashCommandBuilder()
    .setName(commandName)
    .setDescription(description || `Enable or disable ${label || category} stream logs`)
    .addBooleanOption(opt =>
      opt
        .setName('enabled')
        .setDescription('Enable (true) or disable (false)')
        .setRequired(true),
    );

  return {
    data,
    async execute(interaction) {
      if (!interaction.inGuild()) {
        return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.editReply({ content: 'You need Manage Server to configure this.' });
      }

      const enabled = interaction.options.getBoolean('enabled', true);
      try {
        await streamLogStore.setEnabled(interaction.guildId, category, enabled);
      } catch (err) {
        return interaction.editReply({ content: 'Failed to update the log mode.' });
      }

      const humanLabel = label || category;
      return interaction.editReply({ content: `${humanLabel} stream logs are now ${enabled ? 'enabled' : 'disabled'}.` });
    },
  };
}

module.exports = {
  buildSetCommand,
  buildModeCommand,
};
