const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
} = require('discord.js');
const ticketStore = require('./ticketStore');
const { parseColorInput } = require('./colorParser');

async function respond(interaction, payload, followUp = false) {
  const data = { ephemeral: true, ...payload };
  if (followUp) {
    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(data);
    }
    return interaction.reply(data);
  }
  if (interaction.replied) {
    return interaction.followUp(data);
  }
  if (interaction.deferred) {
    return interaction.editReply(data);
  }
  return interaction.reply(data);
}

function sanitiseUrl(input) {
  if (!input || typeof input !== 'string') return null;
  try {
    const url = new URL(input.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch (_) {
    return null;
  }
}

function applyPlaceholders(text, context = {}) {
  if (!text || typeof text !== 'string') return text;
  const replacements = new Map();
  if (context.user) {
    replacements.set('user', `<@${context.user.id}>`);
    replacements.set('user_name', context.member?.displayName || context.user.username);
    replacements.set('user_tag', context.user.tag || `${context.user.username}`);
    replacements.set('user_id', context.user.id);
  }
  if (context.panel) {
    replacements.set('panel_name', context.panel.name || 'Ticket');
  }
  if (context.ticket) {
    replacements.set('ticket_number', String(context.ticket.ticketNumber || context.ticket.id));
    replacements.set('ticket_id', context.ticket.id);
  }
  if (context.config?.supportRoleIds?.length) {
    replacements.set('support_role', context.config.supportRoleIds.map(id => `<@&${id}>`).join(', '));
  }
  replacements.set('guild_name', context.guild?.name || 'this server');

  return text.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key) => {
    const lower = String(key || '').toLowerCase();
    if (!replacements.has(lower)) return `{{${lower}}}`;
    return replacements.get(lower);
  });
}

function buildEmbed(embedData = {}, context = null) {
  const embed = new EmbedBuilder();
  const colour = parseColorInput(embedData.color || null, 0x5865f2);
  if (colour) embed.setColor(colour);
  const apply = value => (context ? applyPlaceholders(value, context) : value);
  if (embedData.title) embed.setTitle(apply(embedData.title).slice(0, 256));
  if (embedData.description) embed.setDescription(apply(embedData.description).slice(0, 4096));
  if (embedData.image) {
    const safeImage = sanitiseUrl(embedData.image);
    if (safeImage) embed.setImage(safeImage);
  }
  if (embedData.thumbnail) {
    const safeThumb = sanitiseUrl(embedData.thumbnail);
    if (safeThumb) embed.setThumbnail(safeThumb);
  }
  if (embedData.footer) {
    embed.setFooter({ text: apply(embedData.footer).slice(0, 2048) });
  }
  return embed;
}

function panelComponents(panel) {
  if (!panel || !panel.component) return [];
  if (panel.component.type === 'menu') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`ticket:menu:${panel.id}`)
      .setPlaceholder(panel.component.placeholder || 'Select an option')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(panel.component.options.map(opt => ({
        label: opt.label,
        value: opt.value,
        description: opt.description || undefined,
        emoji: opt.emoji || undefined,
      })));
    return [new ActionRowBuilder().addComponents(menu)];
  }

  let style = ButtonStyle.Primary;
  switch ((panel.component.style || '').toLowerCase()) {
    case 'success':
      style = ButtonStyle.Success;
      break;
    case 'danger':
      style = ButtonStyle.Danger;
      break;
    case 'secondary':
      style = ButtonStyle.Secondary;
      break;
    default:
      style = ButtonStyle.Primary;
  }

  const button = new ButtonBuilder()
    .setCustomId(`ticket:create:${panel.id}`)
    .setLabel(panel.component.label || 'Create Ticket')
    .setStyle(style);

  return [new ActionRowBuilder().addComponents(button)];
}

function buildControlComponents(ticket) {
  const claimButton = new ButtonBuilder()
    .setCustomId(`ticket:claim:${ticket.id}`)
    .setLabel(ticket.claimedBy ? 'Claimed' : 'Claim Ticket')
    .setStyle(ticket.claimedBy ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setDisabled(!!ticket.claimedBy);

  const closeButton = new ButtonBuilder()
    .setCustomId(`ticket:close:${ticket.id}`)
    .setLabel('Close Ticket')
    .setStyle(ButtonStyle.Danger);

  return [new ActionRowBuilder().addComponents(claimButton, closeButton)];
}

async function logTicket(guild, panel, ticket, action, extras = {}) {
  if (!guild) return;
  const config = ticketStore.getConfig(guild.id);
  const logChannelId = panel.logChannelId || config.logChannelId;
  if (!logChannelId) return;
  let logChannel = null;
  try {
    logChannel = await guild.channels.fetch(logChannelId);
  } catch (_) {
    return;
  }
  if (!logChannel || !logChannel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(`Ticket ${action}`)
    .setColor(action === 'Closed' ? 0xffa500 : 0x3ba55d)
    .addFields(
      { name: 'Panel', value: panel.name, inline: true },
      { name: 'Ticket', value: `#${ticket.ticketNumber}`, inline: true },
      { name: 'User', value: `<@${ticket.userId}>`, inline: true },
    )
    .setTimestamp(new Date());

  if (extras.reason) embed.addFields({ name: 'Reason', value: extras.reason.slice(0, 100), inline: false });
  if (extras.closedBy) embed.addFields({ name: 'Handled By', value: `<@${extras.closedBy}>`, inline: false });
  if (extras.location) embed.addFields({ name: 'Location', value: extras.location, inline: false });

  try {
    await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to log ticket action:', err);
  }
}

async function sendToArchive(guild, panel, ticket, summary, sourceChannel) {
  const config = ticketStore.getConfig(guild.id);
  const archiveChannelId = panel.archiveChannelId || config.archiveChannelId;
  if (!archiveChannelId) return;
  let archiveChannel = null;
  try {
    archiveChannel = await guild.channels.fetch(archiveChannelId);
  } catch (_) {
    return;
  }
  if (!archiveChannel) return;

  if (archiveChannel.type === ChannelType.GuildCategory) {
    if (sourceChannel && typeof sourceChannel.setParent === 'function') {
      try {
        await sourceChannel.setParent(archiveChannel, { lockPermissions: false });
      } catch (err) {
        console.warn('Failed to move ticket channel to archive category:', err.message);
      }
    }
    return;
  }

  if (!archiveChannel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(`Ticket Archived • ${panel.name}`)
    .setColor(0x5865f2)
    .addFields(
      { name: 'Ticket', value: `#${ticket.ticketNumber}`, inline: true },
      { name: 'User', value: `<@${ticket.userId}>`, inline: true },
    )
    .setTimestamp(new Date());

  if (summary) embed.setDescription(summary.slice(0, 2000));

  if (sourceChannel) {
    const link = sourceChannel.isThread() ? sourceChannel.url : `https://discord.com/channels/${guild.id}/${sourceChannel.id}`;
    embed.addFields({ name: 'Link', value: link, inline: false });
  }

  try {
    await archiveChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to send ticket archive entry:', err);
  }
}

async function ensureSupportRole(interaction, config) {
  if (!interaction || !interaction.member) return false;
  if (!config.supportRoleIds?.length) return false;
  const memberRoles = interaction.member.roles?.cache;
  if (!memberRoles) return false;
  return config.supportRoleIds.some(roleId => memberRoles.has(roleId));
}

async function openTicket(interaction, panel, reason) {
  if (!interaction.inGuild()) {
    await respond(interaction, { content: 'Tickets can only be created in a server.' });
    return null;
  }

  const config = ticketStore.getConfig(interaction.guildId);
  const currentOpen = ticketStore.countOpenTicketsForUser(interaction.guildId, interaction.user.id);
  if (currentOpen >= (config.maxTicketsPerUser || 2)) {
    await respond(interaction, { content: `You already have ${currentOpen} open ticket(s). Please wait until a support member closes them before opening another.` });
    return null;
  }

  const me = interaction.guild.members.me;
  if (!me) {
    await respond(interaction, { content: 'Bot member context missing. Try again later.' });
    return null;
  }

  let ticketChannel = null;
  let ticketThread = null;
  const panelNameSafe = panel.name.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'ticket';

  if (panel.ticketType === 'thread') {
    if (!interaction.channel || !interaction.channel.isTextBased() || interaction.channel.isThread()) {
      await respond(interaction, { content: 'Thread tickets can only be opened from a text channel.' });
      return null;
    }
    try {
      ticketThread = await interaction.channel.threads.create({
        name: `${panelNameSafe}-${Date.now().toString(36)}`.slice(0, 90),
        type: ChannelType.PrivateThread,
        autoArchiveDuration: 1440,
        reason: `Ticket for ${interaction.user.tag}`,
        invitable: false,
      });
      await ticketThread.members.add(interaction.user.id);
    } catch (err) {
      console.error('Failed to create ticket thread:', err);
      await respond(interaction, { content: 'Could not create a ticket thread. Please contact an admin.' });
      return null;
    }
  } else {
    if (!me.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      await respond(interaction, { content: 'I need Manage Channels permission to create ticket channels.' });
      return null;
    }
    const overwrites = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
      { id: interaction.user.id, allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
        PermissionsBitField.Flags.EmbedLinks,
      ] },
      { id: me.id, allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageMessages,
      ] },
    ];

    for (const roleId of config.supportRoleIds || []) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      });
    }

    let parent = null;
    if (panel.ticketParentId) {
      try {
        const category = await interaction.guild.channels.fetch(panel.ticketParentId);
        if (category && category.type === ChannelType.GuildCategory) parent = category;
      } catch (_) {}
    }

    try {
      ticketChannel = await interaction.guild.channels.create({
        name: `${panelNameSafe}-${Date.now().toString(36)}`.slice(0, 80),
        type: ChannelType.GuildText,
        parent: parent || null,
        permissionOverwrites: overwrites,
        reason: `Ticket for ${interaction.user.tag}`,
      });
    } catch (err) {
      console.error('Failed to create ticket channel:', err);
      await respond(interaction, { content: 'Could not create a ticket channel. Please contact an admin.' });
      return null;
    }
  }

  const target = ticketThread || ticketChannel;
  const ticketRecord = ticketStore.createTicket(interaction.guildId, {
    panelId: panel.id,
    userId: interaction.user.id,
    reason,
    channelId: ticketChannel ? ticketChannel.id : null,
    threadId: ticketThread ? ticketThread.id : null,
  });

  const context = {
    user: interaction.user,
    member: interaction.member,
    panel,
    ticket: ticketRecord,
    guild: interaction.guild,
    config,
  };
  const introEmbed = buildEmbed(panel.embed, context);

  let supportMention = config.supportRoleIds?.length ? config.supportRoleIds.map(id => `<@&${id}>`).join(' ') : '';
  const introContent = [`Ticket opened by <@${interaction.user.id}>.`];
  if (reason) introContent.push(`Reason: **${reason}**`);
  if (supportMention) introContent.push(`Notifying: ${supportMention}`);

  try {
    const controlMessage = await target.send({
      content: introContent.join('\n'),
      embeds: [introEmbed],
      components: buildControlComponents(ticketRecord),
      allowedMentions: { users: [interaction.user.id], roles: config.supportRoleIds || [] },
    });
    ticketStore.setTicketControlMessage(interaction.guildId, ticketRecord.id, controlMessage.id);
  } catch (err) {
    console.error('Failed to send ticket intro message:', err);
  }

  await logTicket(interaction.guild, panel, ticketRecord, 'Opened', { reason });

  await respond(interaction, { content: `✅ Ticket created: ${target.toString()}` });

  return { ticket: ticketRecord, channel: ticketChannel, thread: ticketThread };
}

async function claimTicket(interaction, ticketId) {
  const ticket = ticketStore.getTicket(interaction.guildId, ticketId);
  if (!ticket) {
    await respond(interaction, { content: 'This ticket is no longer active.' });
    return null;
  }
  const config = ticketStore.getConfig(interaction.guildId);
  const isSupport = await ensureSupportRole(interaction, config);
  if (!isSupport) {
    await respond(interaction, { content: 'Only support staff can claim tickets.' });
    return null;
  }
  if (ticket.claimedBy) {
    await respond(interaction, { content: `Ticket already claimed by <@${ticket.claimedBy}>.` });
    return null;
  }

  ticketStore.markTicketClaimed(interaction.guildId, ticketId, interaction.user.id);

  const channelId = ticket.channelId || ticket.threadId;
  let channel = null;
  try {
    channel = await interaction.guild.channels.fetch(channelId);
  } catch (_) {}

  if (channel) {
    try {
      const message = await channel.messages.fetch(ticket.controlMessageId);
      const updatedTicket = ticketStore.getTicket(interaction.guildId, ticketId) || { ...ticket, claimedBy: interaction.user.id };
      await message.edit({ components: buildControlComponents(updatedTicket) });
    } catch (err) {
      console.warn('Failed to update ticket control message after claim:', err.message);
    }
    try {
      await channel.send(`✅ Ticket claimed by <@${interaction.user.id}>.`);
    } catch (_) {}
  }

  await respond(interaction, { content: 'You have claimed this ticket.' });
  return ticketStore.getTicket(interaction.guildId, ticketId);
}

async function closeTicket(interaction, ticketId) {
  const ticket = ticketStore.getTicket(interaction.guildId, ticketId);
  if (!ticket) {
    await respond(interaction, { content: 'This ticket is no longer active.' });
    return null;
  }
  const config = ticketStore.getConfig(interaction.guildId);
  const isSupport = await ensureSupportRole(interaction, config);
  if (!isSupport) {
    await respond(interaction, { content: 'Only support staff can close tickets.' });
    return null;
  }

  const panel = ticketStore.getPanel(interaction.guildId, ticket.panelId);
  if (!panel) {
    await respond(interaction, { content: 'Panel configuration missing for this ticket.' });
    return null;
  }

  const closed = ticketStore.closeTicket(interaction.guildId, ticketId);
  const channelId = ticket.channelId || ticket.threadId;
  let channel = null;
  try {
    channel = await interaction.guild.channels.fetch(channelId);
  } catch (_) {}

  if (channel?.isThread()) {
    try {
      await channel.setLocked(true, 'Ticket closed');
      await channel.setArchived(true, 'Ticket closed');
    } catch (err) {
      console.warn('Failed to lock/archive ticket thread:', err.message);
    }
  } else if (channel?.isTextBased()) {
    try {
      await channel.send('🔒 Ticket closed. This channel will be moved to archive shortly.');
    } catch (_) {}
  }

  await logTicket(interaction.guild, panel, closed, 'Closed', {
    reason: closed.reason,
    closedBy: interaction.user.id,
    location: channel ? (channel.isThread() ? channel.url : `<#${channel.id}>`) : 'Channel deleted',
  });

  await sendToArchive(interaction.guild, panel, closed, 'Ticket closed by support.', channel);

  await respond(interaction, { content: 'Ticket closed.' });

  return closed;
}

module.exports = {
  buildEmbed,
  panelComponents,
  buildControlComponents,
  openTicket,
  claimTicket,
  closeTicket,
};
