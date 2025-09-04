const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Send a message as the bot')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDMPermission(false)
    .addStringOption(opt =>
      opt.setName('message')
        .setDescription('Text to send')
        .setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send to (defaults to here)')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
        )
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('allow_mentions')
        .setDescription('Allow @everyone/@here/roles/users mentions (default: off)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.editReply({ content: 'Only server administrators can use /say.' });
    }

    const text = interaction.options.getString('message', true);
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const allowMentions = interaction.options.getBoolean('allow_mentions') || false;

    const allowedMentions = allowMentions ? undefined : { parse: [] };

    try {
      // chunking for >2000 chars
      if (text.length <= 2000) {
        await channel.send({ content: text, allowedMentions });
      } else {
        for (let i = 0; i < text.length; i += 2000) {
          const chunk = text.slice(i, i + 2000);
          await channel.send({ content: chunk, allowedMentions });
        }
      }
      return interaction.editReply({ content: `Message sent to ${channel}.` });
    } catch (err) {
      return interaction.editReply({ content: `Failed to send message: ${err.message}` });
    }
  },
};

