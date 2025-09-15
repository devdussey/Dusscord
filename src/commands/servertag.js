const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { MAX_TAG_LENGTH, getServerTag, setServerTag, clearServerTag } = require('../utils/serverTagStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servertag')
    .setDescription('View or update the saved server tag')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Update the server tag')
        .addStringOption(opt =>
          opt
            .setName('tag')
            .setDescription(`New server tag (max ${MAX_TAG_LENGTH} characters)`)
            .setRequired(true)
            .setMaxLength(MAX_TAG_LENGTH)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('show')
        .setDescription('Show the currently saved server tag')
    )
    .addSubcommand(sub =>
      sub
        .setName('clear')
        .setDescription('Remove the saved server tag')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this in a server.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server to use this command.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const raw = interaction.options.getString('tag', true);
      try {
        const saved = await setServerTag(interaction.guildId, raw);
        return interaction.reply({ content: `Server tag updated to: **${saved}**`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
      }
    }

    if (sub === 'show') {
      const tag = getServerTag(interaction.guildId);
      if (!tag) {
        return interaction.reply({ content: 'No server tag is set.', ephemeral: true });
      }
      return interaction.reply({ content: `Current server tag: **${tag}**`, ephemeral: true });
    }

    if (sub === 'clear') {
      const removed = await clearServerTag(interaction.guildId);
      return interaction.reply({
        content: removed ? 'Server tag cleared.' : 'No server tag was set.',
        ephemeral: true,
      });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};
