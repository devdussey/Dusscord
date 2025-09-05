const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const logger = require('../utils/securityLogger');

function isOwner(userId) {
  const raw = process.env.BOT_OWNER_IDS || '';
  const ids = raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  return ids.includes(String(userId));
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dmdiag')
    .setDescription('Diagnose whether the bot can DM members')
    .addSubcommand(sub =>
      sub
        .setName('test')
        .setDescription('Test DM to a single member (message is auto-deleted)')
        .addUserOption(opt =>
          opt.setName('member').setDescription('Member to test').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('role')
        .setDescription('Bulk-check members of a role (sends and deletes a tiny test DM)')
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to test').setRequired(true)
        )
        .addIntegerOption(opt =>
          opt.setName('limit').setDescription('Max members to check (default 20, max 100)').setMinValue(1).setMaxValue(100)
        )
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this in a server.', ephemeral: true });

    // Restrict to bot owners only
    if (!isOwner(interaction.user.id)) {
      try { await logger.logPermissionDenied(interaction, 'dmdiag', 'User is not a bot owner'); } catch (err) { console.error('src/commands/dmdiag.js', err); }
      return interaction.reply({ content: 'This command is restricted to bot owners.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'test') {
      await interaction.deferReply({ ephemeral: true });
      const user = interaction.options.getUser('member', true);
      try {
        const dm = await user.createDM();
        const msg = await dm.send({ content: `DM connectivity test from ${interaction.client.user.username} for ${interaction.guild.name}. This message will be removed.` });
        await sleep(500);
        await msg.delete().catch(() => {});
        return interaction.editReply({ content: `Success: I can DM ${user.tag}.` });
      } catch (err) {
        // 50007: Cannot send messages to this user
        const code = err?.code || err?.rawError?.code;
        const reason = code === 50007 ? 'User has DMs closed or blocked the bot.' : (err?.message || 'Unknown error');
        return interaction.editReply({ content: `Cannot DM ${user.tag}. Reason: ${reason}` });
      }
    }

    if (sub === 'role') {
      // Require Manage Guild to avoid abuse
      if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: 'You need Manage Server to run bulk DM diagnostics.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const role = interaction.options.getRole('role', true);
      const limit = interaction.options.getInteger('limit') ?? 20;

      // Fetch members for accuracy
      let members;
      try {
        members = await interaction.guild.members.fetch();
      } catch (err) { console.error('src/commands/dmdiag.js', err);
        members = interaction.guild.members.cache;
      }
      const list = members.filter(m => m.roles.cache.has(role.id) && !m.user.bot).first(limit);

      let ok = 0, fail = 0;
      const failed = [];
      for (const m of list) {
        try {
          const dm = await m.user.createDM();
          const msg = await dm.send({ content: `DM connectivity test from ${interaction.client.user.username} for ${interaction.guild.name}. This message will be removed.` });
          await sleep(300);
          await msg.delete().catch(() => {});
          ok++;
        } catch (err) {
          fail++;
          const code = err?.code || err?.rawError?.code;
          const reason = code === 50007 ? 'DMs closed/blocked' : (err?.message || 'Error');
          failed.push(`${m.user.tag} — ${reason}`);
        }
        // light rate limiting
        await sleep(250);
      }

      const embed = new EmbedBuilder()
        .setTitle('DM Diagnostic Report')
        .setColor(0x0000ff)
        .setDescription(`Role: ${role} • Checked: ${list.length}\nSuccess: ${ok} • Fail: ${fail}`)
        .setTimestamp(new Date());
      if (failed.length) {
        embed.addFields({ name: 'Failed', value: failed.slice(0, 15).join('\n') + (failed.length > 15 ? `\n…and ${failed.length - 15} more` : '') });
      }
      return interaction.editReply({ embeds: [embed] });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};
