const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { createEmbedModal } = require('../utils/embedBuilder');
const ticketStore = require('../utils/ticketStore');
const panelSessions = require('../utils/ticketPanelSessionStore');

function parseMenuOptions(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split('|').map(part => part.trim()).filter(Boolean);
      if (parts.length === 0) return null;
      const [label, value, description] = parts;
      return {
        label: (label || value || `Option ${index + 1}`).slice(0, 80),
        value: (value || label || `option-${index + 1}`).toLowerCase().replace(/[^a-z0-9_-]/gi, '').slice(0, 80) || `option-${index + 1}`,
        description: description ? description.slice(0, 100) : undefined,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panelsetup')
    .setDescription('Create a ticket panel template')
    .addStringOption(option =>
      option
        .setName('name')
        .setDescription('Unique panel name')
        .setRequired(true)
        .setMaxLength(50)
    )
    .addStringOption(option =>
      option
        .setName('ticket_type')
        .setDescription('Whether tickets open as channels or threads')
        .addChoices(
          { name: 'Private channel', value: 'channel' },
          { name: 'Thread (inside the panel channel)', value: 'thread' },
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('component_type')
        .setDescription('Use a button or select menu for ticket reasons')
        .addChoices(
          { name: 'Button', value: 'button' },
          { name: 'Select menu', value: 'menu' },
        )
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('button_label')
        .setDescription('Button label (for button panels)')
        .setMaxLength(80)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('menu_placeholder')
        .setDescription('Placeholder text (for select menu panels)')
        .setMaxLength(100)
        .setRequired(false)
    )
    .addStringOption(option =>
      option
        .setName('menu_options')
        .setDescription('Select menu options (one per line, format: Label|value|Description)')
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('ticket_category')
        .setDescription('Category where ticket channels should be created (channel panels only)')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('log_channel')
        .setDescription('Override log channel for this panel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('archive_channel')
        .setDescription('Override archive channel for this panel')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildCategory)
        .setRequired(false)
    )

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      return interaction.reply({ content: 'You need Manage Server to create ticket panels.', ephemeral: true });
    }

    const config = ticketStore.getConfig(interaction.guildId);
    if (!config.supportRoleIds || config.supportRoleIds.length === 0) {
      return interaction.reply({ content: 'Configure ticket support roles first with /ticketconfig.', ephemeral: true });
    }

    const name = interaction.options.getString('name').trim();
    const ticketType = interaction.options.getString('ticket_type');
    const componentType = interaction.options.getString('component_type');
    const buttonLabel = interaction.options.getString('button_label') || 'Create Ticket';
    const menuPlaceholder = interaction.options.getString('menu_placeholder') || 'Select a ticket reason';
    const rawMenuOptions = interaction.options.getString('menu_options');
    const ticketCategory = interaction.options.getChannel('ticket_category');
    const overrideLogChannel = interaction.options.getChannel('log_channel');
    const overrideArchive = interaction.options.getChannel('archive_channel');

    if (ticketStore.getPanelByName(interaction.guildId, name)) {
      return interaction.reply({ content: 'A panel with that name already exists. Use /panelremove first.', ephemeral: true });
    }

    let menuOptions = [];
    if (componentType === 'menu') {
      menuOptions = parseMenuOptions(rawMenuOptions);
      if (!menuOptions.length) {
        return interaction.reply({ content: 'Provide at least one select menu option (format: Label|value|Description).', ephemeral: true });
      }
    }

    panelSessions.createSession(interaction.guildId, interaction.user.id, {
      name,
      ticketType,
      componentType,
      buttonLabel,
      menuPlaceholder,
      menuOptions,
      ticketParentId: ticketCategory ? ticketCategory.id : null,
      logChannelId: overrideLogChannel ? overrideLogChannel.id : null,
      archiveChannelId: overrideArchive ? overrideArchive.id : null,
    });

    const modal = createEmbedModal({
      customId: 'ticketPanel:embed',
      title: `Ticket Panel • ${name.slice(0, 45)}`,
    });

    return interaction.showModal(modal);
  },
};
