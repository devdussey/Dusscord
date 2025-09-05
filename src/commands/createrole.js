const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const modlog = require('../utils/modLogger');

function normalizeColor(input) {
  if (!input) return null;
  const s = String(input).trim();
  const m = s.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  return `#${m[1]}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createrole')
    .setDescription('Quickly create a role')
    .addStringOption(opt =>
      opt.setName('name')
        .setDescription('Role name')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('color')
        .setDescription('Hex color (e.g., #5865F2 or 5865F2)')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('hoist')
        .setDescription('Display role separately (default: false)')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('mentionable')
        .setDescription('Allow @mentioning this role (default: false)')
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt.setName('position')
        .setDescription('Position in role list (optional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });
    }

    const me = interaction.guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'I need the Manage Roles permission.', ephemeral: true });
    }
    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: 'You need Manage Roles to use this command.', ephemeral: true });
    }

    const name = interaction.options.getString('name', true).slice(0, 100);
    const colorIn = interaction.options.getString('color');
    const color = normalizeColor(colorIn);
    if (colorIn && !color) {
      return interaction.reply({ content: 'Invalid color. Use a 6-digit hex, e.g., #5865F2', ephemeral: true });
    }
    const hoist = interaction.options.getBoolean('hoist') ?? false;
    const mentionable = interaction.options.getBoolean('mentionable') ?? false;
    let position = interaction.options.getInteger('position');

    try {
      // Create at default position first to avoid hierarchy issues
      const role = await interaction.guild.roles.create({
        name,
        color: color ?? undefined,
        hoist,
        mentionable,
        reason: `Created by ${interaction.user.tag} (${interaction.user.id}) via /createrole`,
      });

      // Optional: adjust position if provided and within bounds
      if (typeof position === 'number') {
        const maxPosition = Math.max(1, me.roles.highest.position - 1);
        position = Math.max(1, Math.min(position, maxPosition));
        try {
          await role.setPosition(position);
        } catch (err) { console.error('src/commands/createrole.js', err);
          // If setting position fails, keep role created and continue
        }
      }

      try { await modlog.log(interaction, 'Role Created', [
        { name: 'Role', value: `${role} (${role.id})`, inline: false },
        { name: 'Color', value: String(color || 'default'), inline: true },
        { name: 'Hoist', value: String(hoist), inline: true },
        { name: 'Mentionable', value: String(mentionable), inline: true },
      ]); } catch (err) { console.error('src/commands/createrole.js', err); }
      return interaction.reply({ content: `Created role ${role.toString()}${position ? ` at position ${role.position}` : ''}.`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: `Failed to create role: ${err.message || 'Unknown error'}`, ephemeral: true });
    }
  },
};
