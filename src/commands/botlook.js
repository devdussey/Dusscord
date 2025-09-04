const { SlashCommandBuilder } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botlook')
    .setDescription('Guild owner: change bot avatar, nickname, or bio')
    .addAttachmentOption(opt =>
      opt
        .setName('avatar')
        .setDescription('New avatar image')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('nickname')
        .setDescription('New nickname for the bot in this server')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('bio')
        .setDescription('New bio for the bot user')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: 'Only the guild owner can use this command.', ephemeral: true });
    }

    const client = interaction.client;
    const avatar = interaction.options.getAttachment('avatar');
    const nickname = interaction.options.getString('nickname');
    const bio = interaction.options.getString('bio');

    const changes = [];

    try {
      if (avatar) {
        const res = await fetch(avatar.url);
        const buf = Buffer.from(await res.arrayBuffer());
        await client.user.setAvatar(buf);
        changes.push('avatar');
      }

      if (nickname) {
        await interaction.guild.members.me.setNickname(nickname);
        changes.push('nickname');
      }

      if (bio) {
        let finalBio = bio.trim();
        if (!/clone of dusscord$/i.test(finalBio)) {
          finalBio += `${finalBio ? '\n' : ''}Clone of Dusscord`;
        }
        await client.application.fetch();
        await client.application.edit({ description: finalBio });
        changes.push('bio');
      }
    } catch (err) {
      return interaction.reply({ content: `Error updating bot: ${err.message}`, ephemeral: true });
    }

    if (!changes.length) {
      return interaction.reply({ content: 'No changes provided.', ephemeral: true });
    }

    return interaction.reply({ content: `Updated bot ${changes.join(', ')}.`, ephemeral: true });
  },
};

