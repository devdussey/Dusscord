const { SlashCommandBuilder } = require('discord.js');
const boosterManager = require('../utils/boosterRoleManager');
const boosterConfigStore = require('../utils/boosterRoleConfigStore');

function formatHex(hex) {
  return typeof hex === 'string' ? hex.toUpperCase() : hex;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('brcolor')
    .setDescription('Update the colour of your booster custom role')
    .addStringOption(option =>
      option
        .setName('style')
        .setDescription('Choose a solid colour or gradient')
        .setRequired(true)
        .addChoices(
          { name: 'Solid', value: 'solid' },
          { name: 'Gradient', value: 'gradient' },
        )
    )
    .addStringOption(option =>
      option
        .setName('primary')
        .setDescription('Primary hex colour (example: #ff8800)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('secondary')
        .setDescription('Secondary hex colour for gradients (example: #00ffaa)')
        .setRequired(false)
    ),
  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    const enabled = await boosterConfigStore.isEnabled(interaction.guildId);
    if (!enabled) {
      return interaction.reply({
        content: 'Custom booster roles are disabled on this server. Ask a server manager to enable them with /brconfig.',
        ephemeral: true,
      });
    }

    const style = interaction.options.getString('style', true);
    const primary = interaction.options.getString('primary', true);
    const secondary = interaction.options.getString('secondary');

    if (style === 'gradient' && !secondary) {
      return interaction.reply({
        content: 'Please provide two hex colours when selecting the gradient option.',
        ephemeral: true,
      });
    }

    const config = boosterManager.normalizeColorConfig({
      mode: style,
      colors: style === 'gradient' ? [primary, secondary] : [primary],
      secondary,
    });

    if (!config) {
      return interaction.reply({
        content: 'Please provide valid hex colours, such as #ff8800.',
        ephemeral: true,
      });
    }

    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (err) {
        console.error('Failed to defer /brcolor interaction:', err);
        return;
      }
    }

    try {
      const { config: appliedConfig, unchanged } = await boosterManager.updateRoleColor(interaction.member, config);
      let message;
      if (appliedConfig.mode === 'solid') {
        const [hex] = appliedConfig.colors;
        message = `Set your booster role colour to **${formatHex(hex)}**.`;
      } else {
        const [start, end] = appliedConfig.colors;
        message = `Set your booster role gradient to **${formatHex(start)} → ${formatHex(end)}**.`;
      }
      if (unchanged) {
        message += ' Your role already used these colours, so we reapplied them.';
      }
      await interaction.editReply({ content: message });
    } catch (err) {
      const message = err?.message || 'Failed to update your booster role colour.';
      await interaction.editReply({ content: `Unable to update booster role colour: ${message}` });
    }
  },
};
