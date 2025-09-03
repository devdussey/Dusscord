const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../utils/securityLogger');
const fetch = require('node-fetch');

function parseEmojiInput(input) {
    if (!input) return null;
    // Match custom emoji mention: <a:name:id> or <:name:id>
    const mentionMatch = input.match(/^<(?:(a):)?([a-zA-Z0-9_]{2,32}):([0-9]{15,25})>$/);
    if (mentionMatch) {
        const animated = Boolean(mentionMatch[1]);
        const name = mentionMatch[2];
        const id = mentionMatch[3];
        return { id, name, animated };
    }
    // Match CDN URL
    const urlMatch = input.match(/discord(?:app)?\.com\/emojis\/([0-9]{15,25})\.(png|webp|gif)/i);
    if (urlMatch) {
        const id = urlMatch[1];
        const ext = urlMatch[2].toLowerCase();
        const animated = ext === 'gif';
        return { id, name: undefined, animated };
    }
    // Raw numeric ID
    const idMatch = input.match(/^([0-9]{15,25})$/);
    if (idMatch) {
        return { id: idMatch[1], name: undefined, animated: false };
    }
    return null;
}

function buildEmojiCdnUrl(id, animated) {
    const ext = animated ? 'gif' : 'png';
    return `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`;
}

async function fetchStickerBufferByIdOrUrl(idOrUrl) {
    // If it's a pure ID, try common extensions
    const tryUrls = [];
    if (/^[0-9]{15,25}$/.test(idOrUrl)) {
        const exts = ['png', 'apng', 'gif', 'json'];
        for (const ext of exts) {
            tryUrls.push(`https://cdn.discordapp.com/stickers/${idOrUrl}.${ext}`);
        }
    } else if (/^https?:\/\//i.test(idOrUrl)) {
        tryUrls.push(idOrUrl);
    } else {
        return null;
    }

    for (const url of tryUrls) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const buf = await res.buffer();
                if (buf && buf.length > 0) return { buffer: buf, sourceUrl: url };
            }
        } catch (_) {
            // try next
        }
    }
    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clone')
        .setDescription('Clone emojis or stickers into this server')
        .addSubcommand(sub =>
            sub
                .setName('emoji')
                .setDescription('Clone a custom emoji by mention, ID, or URL')
                .addStringOption(opt =>
                    opt.setName('input')
                        .setDescription('Emoji mention like <:name:id>, ID, or CDN URL')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Optional new emoji name')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('sticker')
                .setDescription('Clone a sticker by ID, URL, or attachment')
                .addStringOption(opt =>
                    opt.setName('id_or_url')
                        .setDescription('Sticker ID or CDN URL (leave empty if using attachment)')
                        .setRequired(false)
                )
                .addAttachmentOption(opt =>
                    opt.setName('file')
                        .setDescription('Sticker file (PNG/APNG/JSON)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('name')
                        .setDescription('Name for the new sticker')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('tags')
                        .setDescription('Tags (e.g., 🙂, happy). Defaults to 🙂')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Optional description')
                        .setRequired(false)
                )
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        const botMember = interaction.guild.members.me;
        if (!botMember.permissions.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
            await logger.logPermissionDenied(interaction, 'clone', 'Bot missing Manage Emojis and Stickers');
            return interaction.reply({ content: 'I need the Manage Emojis and Stickers permission.', ephemeral: true });
        }

        // Optional: require the user to have the same permission to use the command
        if (!interaction.member.permissions?.has(PermissionsBitField.Flags.ManageGuildExpressions)) {
            await logger.logPermissionDenied(interaction, 'clone', 'User missing Manage Emojis and Stickers');
            return interaction.reply({ content: 'You need Manage Emojis and Stickers to use this command.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'emoji') {
            const input = interaction.options.getString('input', true);
            const overrideName = interaction.options.getString('name');

            const parsed = parseEmojiInput(input);
            if (!parsed) {
                return interaction.reply({ content: 'Provide a custom emoji mention like <:name:id>, an emoji ID, or a valid CDN URL.', ephemeral: true });
            }

            const url = buildEmojiCdnUrl(parsed.id, parsed.animated);
            const name = (overrideName || parsed.name || `emoji_${parsed.id}`).slice(0, 32);

            await interaction.deferReply({ ephemeral: true });
            try {
                const created = await interaction.guild.emojis.create({ attachment: url, name });
                const mention = created.animated ? `<a:${created.name}:${created.id}>` : `<:${created.name}:${created.id}>`;
                await interaction.editReply({ content: `Added emoji ${mention}` });
            } catch (err) {
                let reason = 'Failed to add emoji.';
                if (err?.message?.includes('Maximum number of emojis reached')) reason = 'This server has reached the emoji limit.';
                await interaction.editReply({ content: `${reason}` });
            }
            return;
        }

        if (sub === 'sticker') {
            const idOrUrl = interaction.options.getString('id_or_url');
            const fileAttachment = interaction.options.getAttachment('file');
            const nameInput = interaction.options.getString('name');
            const tagsInput = interaction.options.getString('tags') || '🙂';
            const description = interaction.options.getString('description') || undefined;

            if (!idOrUrl && !fileAttachment) {
                return interaction.reply({ content: 'Provide a sticker ID/URL or attach a sticker file.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            let fileBuffer = null;
            let sourceUrl = null;

            try {
                if (fileAttachment?.url) {
                    const res = await fetch(fileAttachment.url);
                    if (!res.ok) throw new Error('Failed to download the attached file');
                    fileBuffer = await res.buffer();
                    sourceUrl = fileAttachment.url;
                } else if (idOrUrl) {
                    const result = await fetchStickerBufferByIdOrUrl(idOrUrl);
                    if (!result) throw new Error('Could not resolve sticker by that ID/URL');
                    fileBuffer = result.buffer;
                    sourceUrl = result.sourceUrl;
                }
            } catch (err) {
                return interaction.editReply({ content: `Download error: ${err.message}` });
            }

            if (!fileBuffer) {
                return interaction.editReply({ content: 'Could not obtain the sticker file.' });
            }

            // Derive a name if not provided
            let name = nameInput;
            if (!name) {
                const fromUrl = sourceUrl?.match(/\/(\d{5,})\.(?:png|apng|gif|json)(?:\?.*)?$/i)?.[1];
                name = (fromUrl ? `sticker_${fromUrl}` : 'sticker_clone');
            }
            name = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30) || 'sticker';

            try {
                const created = await interaction.guild.stickers.create({
                    file: fileBuffer,
                    name,
                    tags: tagsInput,
                    description,
                });
                await interaction.editReply({ content: `Added sticker "${created.name}" (ID: ${created.id})` });
            } catch (err) {
                let msg = 'Failed to add sticker.';
                if (err?.message?.includes('Maximum number of stickers reached')) msg = 'This server has reached the sticker limit.';
                await interaction.editReply({ content: msg });
            }
            return;
        }

        return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    },
};
