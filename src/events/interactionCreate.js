const { Events, PermissionsBitField, EmbedBuilder, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const verifyStore = require('../utils/verificationStore');
const securityLogger = require('../utils/securityLogger');
const verifySession = require('../utils/verificationSession');
const antiNukeManager = require('../utils/antiNukeManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle chat input commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                try {
                    const logger = require('../utils/securityLogger');
                    await logger.logMissingCommand(interaction);
                } catch (_) {}
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                const code = error?.code || error?.status;
                const msg = (error?.message || '').toLowerCase();
                // Ignore common race/expiry cases to prevent noisy logs and dupes
                if (code === 40060 || code === 10062 || msg.includes('already been acknowledged') || msg.includes('unknown interaction')) {
                    console.warn(`Interaction for /${interaction.commandName} expired or was handled elsewhere (code ${code}).`);
                    return;
                }

                console.error(`Error executing ${interaction.commandName}:`, error);

                const errorMessage = 'There was an error while executing this command!';

                // Try to notify the user via the interaction first (best-effort)
                try {
                    if (interaction.replied) {
                        await interaction.followUp({ content: errorMessage, ephemeral: true });
                    } else if (interaction.deferred) {
                        await interaction.editReply({ content: errorMessage });
                    } else {
                        await interaction.reply({ content: errorMessage, ephemeral: true });
                    }
                } catch (replyError) {
                    const rcode = replyError?.code;
                    console.warn('Failed to send error via interaction API:', rcode, replyError?.message);
                }
            }
        }

        // Handle role selection menus (reaction role)
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'rr:select') {
                if (!interaction.inGuild()) return;
                const me = interaction.guild.members.me;
                if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    try { await interaction.reply({ content: 'I need Manage Roles to update your roles.', ephemeral: true }); } catch (_) {}
                    return;
                }
                let member;
                try { member = await interaction.guild.members.fetch(interaction.user.id); } catch (_) {}
                if (!member) {
                    try { await interaction.reply({ content: 'Could not fetch your member data.', ephemeral: true }); } catch (_) {}
                    return;
                }

                // Determine which roles this menu manages (from the component options)
                const menuRoles = interaction.component?.options?.map(o => o.value).filter(Boolean) || [];
                const selected = interaction.values || [];

                const toAdd = selected.filter(id => !member.roles.cache.has(id));
                const toRemove = menuRoles.filter(id => !selected.includes(id) && member.roles.cache.has(id));

                // Filter by hierarchy and non-managed
                const safeAdd = toAdd.filter(id => {
                    const role = interaction.guild.roles.cache.get(id);
                    return role && !role.managed && me.roles.highest.comparePositionTo(role) > 0;
                });
                const safeRemove = toRemove.filter(id => {
                    const role = interaction.guild.roles.cache.get(id);
                    return role && !role.managed && me.roles.highest.comparePositionTo(role) > 0;
                });

                try {
                    if (safeAdd.length) await member.roles.add(safeAdd, 'Reaction role selection');
                    if (safeRemove.length) await member.roles.remove(safeRemove, 'Reaction role selection');
                    await interaction.reply({ content: 'Your roles have been updated.', ephemeral: true });
                } catch (err) {
                    await interaction.reply({ content: `Failed to update roles: ${err.message}`, ephemeral: true });
                }
                return;
            }
            if (typeof interaction.customId === 'string' && interaction.customId.startsWith('antinuke:')) {
                if (!interaction.inGuild()) return;
                if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
                    try { await interaction.reply({ content: 'You need Manage Server to update anti-nuke settings.', ephemeral: true }); } catch (_) {}
                    return;
                }
                try {
                    let updatedConfig = null;
                    if (interaction.customId === 'antinuke:flags') {
                        updatedConfig = await antiNukeManager.updateFlags(interaction.guildId, interaction.values);
                    } else if (interaction.customId === 'antinuke:threshold:channelDelete') {
                        const value = interaction.values?.[0];
                        updatedConfig = await antiNukeManager.updateThreshold(interaction.guildId, 'channelDelete', value);
                    } else if (interaction.customId === 'antinuke:threshold:roleDelete') {
                        const value = interaction.values?.[0];
                        updatedConfig = await antiNukeManager.updateThreshold(interaction.guildId, 'roleDelete', value);
                    } else {
                        return;
                    }
                    const view = await antiNukeManager.buildConfigView(interaction.guild, updatedConfig);
                    await interaction.update({ embeds: [view.embed], components: view.components });
                } catch (err) {
                    console.error('Failed to update anti-nuke configuration via select menu:', err);
                    const content = 'Failed to update anti-nuke settings. Please try again.';
                    try {
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp({ content, ephemeral: true });
                        } else {
                            await interaction.reply({ content, ephemeral: true });
                        }
                    } catch (_) {}
                }
                return;
            }
        }

        // Handle Verify button
        if (interaction.isButton()) {
            if (interaction.customId === 'verify:go') {
                if (!interaction.inGuild()) return;

                const cfg = verifyStore.get(interaction.guild.id);
                if (!cfg) {
                    try { await interaction.reply({ content: 'Verification is not configured on this server.', ephemeral: true }); } catch (_) {}
                    return;
                }

                let role = null;
                try { role = await interaction.guild.roles.fetch(cfg.roleId); } catch (_) {}
                if (!role) {
                    try { await interaction.reply({ content: 'The verification role no longer exists. Please contact an admin.', ephemeral: true }); } catch (_) {}
                    return;
                }

                const me = interaction.guild.members.me;
                if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                    try { await interaction.reply({ content: 'I am missing Manage Roles.', ephemeral: true }); } catch (_) {}
                    return;
                }
                if (role.managed || me.roles.highest.comparePositionTo(role) <= 0) {
                    try { await interaction.reply({ content: 'I cannot assign the verification role due to role hierarchy.', ephemeral: true }); } catch (_) {}
                    return;
                }

                let member = null;
                try { member = await interaction.guild.members.fetch(interaction.user.id); } catch (_) {}
                if (!member) {
                    try { await interaction.reply({ content: 'Could not fetch your member data.', ephemeral: true }); } catch (_) {}
                    return;
                }

                // Check account age requirement
                const minDays = Math.max(0, cfg.minAccountAgeDays || 0);
                if (minDays > 0) {
                    const accountAgeMs = Date.now() - interaction.user.createdTimestamp;
                    const acctDays = Math.floor(accountAgeMs / (24 * 60 * 60 * 1000));
                    if (acctDays < minDays) {
                        try {
                            await interaction.reply({ content: `Your account must be at least ${minDays} day(s) old to verify. Current: ${acctDays} day(s).`, ephemeral: true });
                        } catch (_) {}
                        try { await securityLogger.logPermissionDenied(interaction, 'verify', 'Account below minimum age'); } catch (_) {}
                        return;
                    }
                }

                // Already verified
                if (member.roles.cache.has(role.id)) {
                    try { await interaction.reply({ content: 'You are already verified.', ephemeral: true }); } catch (_) {}
                    return;
                }

                // Begin captcha flow via modal
                const code = [...Array(5)].map(() => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
                verifySession.create(interaction.guild.id, interaction.user.id, {
                    code,
                    roleId: role.id,
                    removeRoleId: cfg.removeRoleId || null,
                    minAccountAgeDays: cfg.minAccountAgeDays || 0,
                    ttlMs: 3 * 60 * 1000,
                    attempts: 3,
                });

                const modal = new ModalBuilder()
                    .setCustomId('verify:modal')
                    .setTitle(`Verification • Enter: ${code}`);
                const input = new TextInputBuilder()
                    .setCustomId('verify:answer')
                    .setLabel('Type the code shown in the title')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(code.length)
                    .setMaxLength(code.length)
                    .setRequired(true);
                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);
                try {
                    await interaction.showModal(modal);
                } catch (_) {
                    try { await interaction.reply({ content: 'Could not open verification challenge. Try again.', ephemeral: true }); } catch (_) {}
                }
                return;
            }
            if (typeof interaction.customId === 'string' && interaction.customId.startsWith('confess:open:')) {
                if (!interaction.inGuild()) return;

                const channelId = interaction.customId.slice('confess:open:'.length);
                let channel = null;
                try { channel = await interaction.guild.channels.fetch(channelId); } catch (_) {}
                if (!channel || !channel.isTextBased?.()) {
                    try { await interaction.reply({ content: 'That confession panel is no longer available.', ephemeral: true }); } catch (_) {}
                    return;
                }

                const modal = new ModalBuilder()
                    .setCustomId(`confess:submit:${channelId}`)
                    .setTitle('Anonymous Confession');
                const input = new TextInputBuilder()
                    .setCustomId('confess:text')
                    .setLabel('Write an anonymous confession')
                    .setStyle(TextInputStyle.Paragraph)
                    .setMinLength(1)
                    .setMaxLength(1000)
                    .setPlaceholder('Write an anonymous confession')
                    .setRequired(true);
                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);

                try {
                    await interaction.showModal(modal);
                } catch (_) {
                    try { await interaction.reply({ content: 'Could not open the confession form. Please try again.', ephemeral: true }); } catch (_) {}
                }
                return;
            }
        }

        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            if (typeof interaction.customId === 'string' && interaction.customId.startsWith('confess:submit:')) {
                if (!interaction.inGuild()) return;

                const channelId = interaction.customId.slice('confess:submit:'.length);
                const confession = (interaction.fields.getTextInputValue('confess:text') || '').trim();

                if (!confession) {
                    try { await interaction.reply({ content: 'Please enter a confession before submitting.', ephemeral: true }); } catch (_) {}
                    return;
                }

                let channel = null;
                try { channel = await interaction.guild.channels.fetch(channelId); } catch (_) {}

                if (!channel || !channel.isTextBased?.()) {
                    try { await interaction.reply({ content: 'The confession channel is no longer available. Please inform an admin.', ephemeral: true }); } catch (_) {}
                    return;
                }

                const sanitized = confession
                    .replace(/@/g, '@\u200b')
                    .replace(/#/g, '#\u200b')
                    .replace(/&/g, '&\u200b');

                const embed = new EmbedBuilder()
                    .setTitle('Anonymous Confession')
                    .setDescription(sanitized)
                    .setTimestamp();

                try {
                    const { applyDefaultColour } = require('../utils/guildColourStore');
                    applyDefaultColour(embed, interaction.guildId);
                } catch (_) {}

                try {
                    await channel.send({ embeds: [embed] });
                } catch (_) {
                    try { await interaction.reply({ content: 'Failed to send your confession. Please try again later.', ephemeral: true }); } catch (_) {}
                    return;
                }

                try { await interaction.reply({ content: 'Your confession has been sent anonymously.', ephemeral: true }); } catch (_) {}
                return;
            }
            // Welcome embed setup modal
            if (typeof interaction.customId === 'string' && interaction.customId.startsWith('welcome:embed:')) {
                if (!interaction.inGuild()) return;
                const parts = interaction.customId.split(':');
                const channelId = parts[2];
                let channel = null;
                try { channel = await interaction.guild.channels.fetch(channelId); } catch (_) {}
                if (!channel) {
                    try { await interaction.reply({ content: 'Saved channel not found. Re-run /welcome setup.', ephemeral: true }); } catch (_) {}
                    return;
                }

                try {
                    const { applyDefaultColour } = require('../utils/guildColourStore');
                    const welcomeStore = require('../utils/welcomeStore');
                    const embed = new EmbedBuilder();
                    const title = interaction.fields.getTextInputValue('embedTitle');
                    const description = interaction.fields.getTextInputValue('embedDescription');
                    const color = interaction.fields.getTextInputValue('embedColor');
                    const image = interaction.fields.getTextInputValue('embedImage');
                    const footer = interaction.fields.getTextInputValue('embedFooter');

                    if (title) embed.setTitle(title);
                    if (description) embed.setDescription(description);
                    if (image) embed.setImage(image);
                    if (footer) embed.setFooter({ text: footer });
                    try { applyDefaultColour(embed, interaction.guildId); } catch (_) {}
                    if (color) { try { embed.setColor(color); } catch (_) {} }

                    // Save configuration
                    welcomeStore.set(interaction.guildId, { channelId, embed: embed.toJSON() });

                    // Preview
                    await channel.send({ content: `Welcome, <@${interaction.user.id}>!`, embeds: [embed] });
                    return interaction.reply({ content: `Welcome message saved for ${channel}.`, ephemeral: true });
                } catch (err) {
                    return interaction.reply({ content: `Failed to save welcome: ${err.message}`, ephemeral: true });
                }
            }
            if (typeof interaction.customId === 'string' && interaction.customId.startsWith('leave:embed:')) {
                if (!interaction.inGuild()) return;
                const parts = interaction.customId.split(':');
                const channelId = parts[2];
                let channel = null;
                try { channel = await interaction.guild.channels.fetch(channelId); } catch (_) {}
                if (!channel) {
                    try { await interaction.reply({ content: 'Saved channel not found. Re-run /leave setup.', ephemeral: true }); } catch (_) {}
                    return;
                }

                try {
                    const { applyDefaultColour } = require('../utils/guildColourStore');
                    const leaveStore = require('../utils/leaveStore');
                    const embed = new EmbedBuilder();
                    const title = interaction.fields.getTextInputValue('embedTitle');
                    const description = interaction.fields.getTextInputValue('embedDescription');
                    const color = interaction.fields.getTextInputValue('embedColor');
                    const image = interaction.fields.getTextInputValue('embedImage');
                    const footer = interaction.fields.getTextInputValue('embedFooter');

                    if (title) embed.setTitle(title);
                    if (description) embed.setDescription(description);
                    if (image) embed.setImage(image);
                    if (footer) embed.setFooter({ text: footer });
                    try { applyDefaultColour(embed, interaction.guildId); } catch (_) {}
                    if (color) { try { embed.setColor(color); } catch (_) {} }

                    leaveStore.set(interaction.guildId, { channelId, embed: embed.toJSON() });

                    const replacer = (value) => String(value || '')
                        .replaceAll('{user}', interaction.user.tag)
                        .replaceAll('{mention}', `<@${interaction.user.id}>`)
                        .replaceAll('{guild}', interaction.guild.name)
                        .replaceAll('{memberCount}', `${interaction.guild.memberCount}`);

                    const preview = EmbedBuilder.from(embed.toJSON());
                    const data = preview.toJSON();
                    if (data.title) preview.setTitle(replacer(data.title));
                    if (data.description) preview.setDescription(replacer(data.description));
                    if (data.footer?.text) preview.setFooter({ text: replacer(data.footer.text), iconURL: data.footer.icon_url || undefined });

                    await channel.send({ content: replacer('{user} has left the server.'), embeds: [preview] });
                    return interaction.reply({ content: `Leave message saved for ${channel}.`, ephemeral: true });
                } catch (err) {
                    return interaction.reply({ content: `Failed to save leave: ${err.message}`, ephemeral: true });
                }
            }
            if (interaction.customId === 'verify:modal') {
                if (!interaction.inGuild()) return;
                const sess = verifySession.get(interaction.guild.id, interaction.user.id);
                if (!sess) {
                    try { await interaction.reply({ content: 'Verification session expired. Press Verify again.', ephemeral: true }); } catch (_) {}
                    return;
                }
                const answer = (interaction.fields.getTextInputValue('verify:answer') || '').trim().toUpperCase();
                const expect = String(sess.code || '').toUpperCase();

                if (answer !== expect) {
                    const after = verifySession.consumeAttempt(interaction.guild.id, interaction.user.id);
                    if (!after || after.attempts <= 0) {
                        try { await interaction.reply({ content: 'Incorrect code. Session ended. Press Verify to try again.', ephemeral: true }); } catch (_) {}
                        return;
                    }
                    try { await interaction.reply({ content: `Incorrect code. Attempts left: ${after.attempts}. Press Verify to try again.`, ephemeral: true }); } catch (_) {}
                    return;
                }

                // Correct answer; proceed to assign role
                verifySession.clear(interaction.guild.id, interaction.user.id);

                let role = null;
                try { role = await interaction.guild.roles.fetch(sess.roleId); } catch (_) {}
                if (!role) {
                    try { await interaction.reply({ content: 'Verification role was removed. Contact an admin.', ephemeral: true }); } catch (_) {}
                    return;
                }
                let member = null;
                try { member = await interaction.guild.members.fetch(interaction.user.id); } catch (_) {}
                if (!member) {
                    try { await interaction.reply({ content: 'Could not fetch your member data.', ephemeral: true }); } catch (_) {}
                    return;
                }
                const me = interaction.guild.members.me;
                if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles) || role.managed || me.roles.highest.comparePositionTo(role) <= 0) {
                    try { await interaction.reply({ content: 'I cannot assign the verification role due to missing permission or role hierarchy.', ephemeral: true }); } catch (_) {}
                    return;
                }
                try {
                    await member.roles.add(role, 'User verified via captcha');
                    if (sess.removeRoleId) {
                        let removeRole = null;
                        try { removeRole = await interaction.guild.roles.fetch(sess.removeRoleId); } catch (_) {}
                        if (removeRole && removeRole.id !== role.id && !removeRole.managed && me.roles.highest.comparePositionTo(removeRole) > 0) {
                            try {
                                await member.roles.remove(removeRole, 'User verified via captcha');
                            } catch (removeErr) {
                                console.warn('Failed to remove configured verification remove-role:', removeErr);
                            }
                        }
                    }
                    try { await interaction.reply({ content: 'Verification passed. Role assigned. Welcome!', ephemeral: true }); } catch (_) {}
                } catch (err) {
                    try { await interaction.reply({ content: `Failed to assign role: ${err.message}`, ephemeral: true }); } catch (_) {}
                }
                return;
            }
            if (interaction.customId === 'embedBuilderModal') {
                await interaction.deferReply();
                
                const title = interaction.fields.getTextInputValue('embedTitle');
                const description = interaction.fields.getTextInputValue('embedDescription');
                const color = interaction.fields.getTextInputValue('embedColor') || '#0000ff';
                const image = interaction.fields.getTextInputValue('embedImage');


                try {
                    const embed = new EmbedBuilder()
                        .setColor(color)
                        ;

                    if (title) embed.setTitle(title);
                    if (description) embed.setDescription(description);
                    if (image) embed.setImage(image);             

                    await interaction.editReply({
                        embeds: [embed]
                    });
                } catch (error) {
                    await interaction.editReply({
                        content: '❌ Error creating embed. Please check your inputs (especially image URL and color format).'
                    });
                }
            }
        }
    },
};
