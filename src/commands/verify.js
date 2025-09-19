const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../utils/verificationStore');
const logger = require('../utils/securityLogger');

function days(ms) { return Math.floor(ms / (24 * 60 * 60 * 1000)); }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Setup and manage the server verification system')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Post a Verify button and configure the verification role')
        // Required first
        .addRoleOption(opt => opt.setName('role').setDescription('Role to grant on verification').setRequired(true))
        .addRoleOption(opt => opt.setName('remove_role').setDescription('Role to remove on verification').setRequired(false))
        // Optional after required
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post the verification message (defaults to here)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addStringOption(opt => opt.setName('title').setDescription('Embed title').setRequired(false))
        .addStringOption(opt => opt.setName('description').setDescription('Embed description').setRequired(false))
        .addStringOption(opt => opt.setName('button_label').setDescription('Button label (default: Verify)').setRequired(false))
        .addIntegerOption(opt => opt.setName('min_account_age_days').setDescription('Minimum account age to pass (days, default 0)').setMinValue(0).setMaxValue(3650).setRequired(false))
    )
    .addSubcommand(sub => sub.setName('status').setDescription('Show current verification configuration'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable verification and remove saved configuration'))
    .addSubcommand(sub =>
      sub.setName('repost')
        .setDescription('Repost the verification message from the saved configuration')
        .addChannelOption(opt =>
          opt.setName('channel')
            .setDescription('Channel to post in (defaults to saved channel)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) return interaction.reply({ content: 'Use this command in a server.', ephemeral: true });

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server to manage verification.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const me = interaction.guild.members.me;

    if (sub === 'setup') {
      const role = interaction.options.getRole('role', true);
      const removeRole = interaction.options.getRole('remove_role');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const title = interaction.options.getString('title') || 'Server Verification';
      const description = interaction.options.getString('description') || 'Click the button below to get verified and access the server.';
      const label = interaction.options.getString('button_label') || 'Verify';
      const minAgeDays = interaction.options.getInteger('min_account_age_days') ?? 0;

      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({ content: 'I need Manage Roles to assign the verification role.', ephemeral: true });
      }
      if (role.managed) {
        return interaction.reply({ content: `I cannot manage ${role} because it is managed by an integration.`, ephemeral: true });
      }
      if (me.roles.highest.comparePositionTo(role) <= 0) {
        return interaction.reply({ content: `My highest role must be above ${role} to assign it.`, ephemeral: true });
      }

      if (removeRole) {
        if (removeRole.id === role.id) {
          return interaction.reply({ content: 'The role to remove cannot be the same as the role granted on verification.', ephemeral: true });
        }
        if (removeRole.managed) {
          return interaction.reply({ content: `I cannot manage ${removeRole} because it is managed by an integration.`, ephemeral: true });
        }
        if (me.roles.highest.comparePositionTo(removeRole) <= 0) {
          return interaction.reply({ content: `My highest role must be above ${removeRole} to remove it.`, ephemeral: true });
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description);
      try {
        const { applyDefaultColour } = require('../utils/guildColourStore');
        applyDefaultColour(embed, interaction.guildId);
      } catch (_) {}

      const button = new ButtonBuilder()
        .setCustomId('verify:go')
        .setLabel(label)
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(button);

      try {
        const msg = await channel.send({ embeds: [embed], components: [row] });
        store.set(interaction.guild.id, {
          channelId: channel.id,
          messageId: msg.id,
          roleId: role.id,
          removeRoleId: removeRole?.id || null,
          minAccountAgeDays: Math.max(0, minAgeDays | 0),
          label,
          title,
          description,
        });
        if (channel.id !== interaction.channel.id) {
          await interaction.reply({ content: `Verification message posted in ${channel}.`, ephemeral: true });
        } else {
          await interaction.reply({ content: 'Verification is set up.', ephemeral: true });
        }
      } catch (err) {
        return interaction.reply({ content: `Failed to post in ${channel}: ${err.message}`, ephemeral: true });
      }
      return;
    }

    if (sub === 'status') {
      const cfg = store.get(interaction.guild.id);
      if (!cfg) return interaction.reply({ content: 'Verification is not configured.', ephemeral: true });
      const age = cfg.minAccountAgeDays ?? 0;
      return interaction.reply({
        content: `Verification configured:\n- Channel: <#${cfg.channelId}>\n- Role: <@&${cfg.roleId}>\n- Remove role: ${cfg.removeRoleId ? `<@&${cfg.removeRoleId}>` : 'None'}\n- Min account age: ${age} day(s)\n- Button label: ${cfg.label || 'Verify'}`,
        ephemeral: true,
      });
    }

    if (sub === 'disable') {
      const existed = store.clear(interaction.guild.id);
      return interaction.reply({ content: existed ? 'Verification disabled and configuration cleared.' : 'Verification was not configured.', ephemeral: true });
    }

    if (sub === 'repost') {
      const cfg = store.get(interaction.guild.id);
      if (!cfg) return interaction.reply({ content: 'Verification is not configured.', ephemeral: true });
      const channel = interaction.options.getChannel('channel') || (await interaction.guild.channels.fetch(cfg.channelId).catch(() => null)) || interaction.channel;
      const role = await interaction.guild.roles.fetch(cfg.roleId).catch(() => null);
      if (!role) return interaction.reply({ content: 'Saved role no longer exists. Re-run setup.', ephemeral: true });
      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return interaction.reply({ content: 'I need Manage Roles to assign the verification role.', ephemeral: true });
      }
      if (me.roles.highest.comparePositionTo(role) <= 0 || role.managed) {
        return interaction.reply({ content: 'I can no longer manage the saved role. Adjust role order or re-run setup.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setTitle(cfg.title || 'Server Verification')
        .setDescription(cfg.description || 'Click the button below to get verified and access the server.');
      try {
        const { applyDefaultColour } = require('../utils/guildColourStore');
        applyDefaultColour(embed, interaction.guildId);
      } catch (_) {}
      const button = new ButtonBuilder()
        .setCustomId('verify:go')
        .setLabel(cfg.label || 'Verify')
        .setStyle(ButtonStyle.Success);
      const row = new ActionRowBuilder().addComponents(button);
      try {
        const msg = await channel.send({ embeds: [embed], components: [row] });
        store.set(interaction.guild.id, { ...cfg, channelId: channel.id, messageId: msg.id });
        return interaction.reply({ content: `Verification message posted in ${channel}.`, ephemeral: true });
      } catch (err) {
        return interaction.reply({ content: `Failed to post in ${channel}: ${err.message}`, ephemeral: true });
      }
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};
