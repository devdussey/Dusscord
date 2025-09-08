const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const store = require('../utils/blacklistStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manage server blacklist')
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a user to the blacklist and ban them')
        .addUserOption(opt =>
          opt.setName('user').setDescription('User to blacklist').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('reason').setDescription('Reason for blacklisting').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the blacklist and unban them')
        .addStringOption(opt =>
          opt.setName('userid').setDescription('ID or mention of the user').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List blacklisted users')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    await interaction.deferReply();

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.editReply({ content: 'I need the Ban Members permission.' });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.editReply({ content: 'You need Ban Members to use this command.' });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const user = interaction.options.getUser('user', true);
      const reasonRaw = interaction.options.getString('reason', true).trim();
      const reason = reasonRaw.slice(0, 400) || 'No reason provided';

      await store.add(interaction.guild.id, user.id, user.tag, reason);
      try {
        await interaction.guild.members.ban(user.id, { reason: `Blacklisted: ${reason}`.slice(0, 512) });
      } catch (err) {
        // ignore
      }
      return interaction.editReply({ content: `Blacklisted ${user.tag} for: ${reason}` });
    }

    if (sub === 'remove') {
      const raw = interaction.options.getString('userid', true);
      const userId = raw.replace(/[^0-9]/g, '');
      const info = await store.get(interaction.guild.id, userId);
      if (!info) {
        return interaction.editReply({ content: 'That user is not on the blacklist.' });
      }
      await store.remove(interaction.guild.id, userId);
      try { await interaction.guild.bans.remove(userId, 'Blacklist removal'); } catch (_) {}
      return interaction.editReply({ content: `Removed ${info.username || userId} from the blacklist.` });
    }

    if (sub === 'list') {
      const list = await store.list(interaction.guild.id);
      if (!list.length) return interaction.editReply({ content: 'Blacklist is empty.' });
      const lines = list.map(entry => `• ${entry.username || entry.userId} — ${entry.reason || 'No reason'}`);
      return interaction.editReply({ content: lines.join('\n') });
    }

    return interaction.editReply({ content: 'Unknown subcommand.' });
  },
};
