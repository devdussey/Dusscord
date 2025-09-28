const {
    SlashCommandBuilder,
    PermissionsBitField,
    parseEmoji,
    StickerFormatType,
    Routes,
} = require('discord.js');
const logger = require('../utils/securityLogger');
// node-fetch v3 is ESM-only; use dynamic import in CommonJS
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function buildEmojiCdnUrl(id, animated, size = 128, extOverride) {
    const ext = extOverride || (animated ? 'gif' : 'png');
    return `https://cdn.discordapp.com/emojis/${id}.${ext}?size=${size}&quality=lossless`;
}

function sanitizeEmojiName(name, fallback) {
    const trimmed = (name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_{2,}/g, '_');
    const finalName = trimmed || fallback || 'emoji';
    return finalName.slice(0, 32);
}

function sanitizeStickerName(name, fallback = 'sticker') {
    const trimmed = (name || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_{2,}/g, '_');
    const finalName = trimmed || fallback;
    return finalName.slice(0, 30);
}

function findCachedEmoji(client, id) {
    if (!client || !id) return null;
    try {
        if (client.emojis?.cache?.has(id)) {
            return client.emojis.cache.get(id);
        }
    } catch (_) {
        // Ignore manager access issues and fall back to guild scan.
    }
    for (const guild of client.guilds.cache.values()) {
        const emoji = guild.emojis.cache.get(id);
        if (emoji) return emoji;
    }
    return null;
}

async function sniffEmojiFromCdn(id) {
    const variants = [
        { ext: 'gif', animated: true },
        { ext: 'png', animated: false },
        { ext: 'webp', animated: false },
    ];

    for (const variant of variants) {
        const url = buildEmojiCdnUrl(id, variant.animated, 128, variant.ext);
        try {
            let res = await fetch(url, { method: 'HEAD' });
            if (!res.ok) {
                res = await fetch(url);
            }
            if (res.ok) {
                return { animated: variant.animated, explicitUrl: url };
            }
        } catch (_) {
            // try next variant
        }
    }
    return null;
}

async function parseEmojiInput(input, client) {
    if (!input) return null;

    const parsedEmoji = parseEmoji(input);
    if (parsedEmoji?.id) {
        const cachedEmoji = findCachedEmoji(client, parsedEmoji.id);
        const animated = Boolean(parsedEmoji.animated || cachedEmoji?.animated);
        const explicitUrl = cachedEmoji?.imageURL({ extension: animated ? 'gif' : 'png', size: 128 }) || null;
        const name = cachedEmoji?.name || parsedEmoji.name;
        return { id: parsedEmoji.id, name, animated, explicitUrl };
    }

    const urlMatch = input.match(/https?:\/\/(?:media\.)?discord(?:app)?\.com\/emojis\/([0-9]{15,25})\.(png|webp|gif)/i);
    if (urlMatch) {
        const id = urlMatch[1];
        const ext = urlMatch[2].toLowerCase();
        return {
            id,
            name: undefined,
            animated: ext === 'gif',
            explicitUrl: input,
        };
    }

    const idMatch = input.match(/^([0-9]{15,25})$/);
    if (idMatch) {
        const id = idMatch[1];
        const cachedEmoji = findCachedEmoji(client, id);
        if (cachedEmoji) {
            const animated = Boolean(cachedEmoji.animated);
            const explicitUrl = cachedEmoji.imageURL({ extension: animated ? 'gif' : 'png', size: 128 });
            return { id, name: cachedEmoji.name, animated, explicitUrl };
        }

        const sniffed = await sniffEmojiFromCdn(id);
        if (sniffed) {
            return { id, name: undefined, animated: sniffed.animated, explicitUrl: sniffed.explicitUrl };
        }

        return { id, name: undefined, animated: false, explicitUrl: null };
    }

    return null;
}

async function fetchStickerBufferByIdOrUrl(idOrUrl, preferredExt) {
    const tryUrls = [];
    if (/^[0-9]{15,25}$/.test(idOrUrl)) {
        const baseExts = ['png', 'apng', 'gif', 'json'];
        const order = preferredExt && baseExts.includes(preferredExt)
            ? [preferredExt, ...baseExts.filter(ext => ext !== preferredExt)]
            : baseExts;
        for (const ext of order) {
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

function extractStickerMention(input) {
    if (!input) return null;
    const match = input.match(/^<(?:(a):)?([a-zA-Z0-9_]{2,32}):([0-9]{15,25})>$/);
    if (!match) return null;
    return { id: match[3], name: match[2], animated: Boolean(match[1]) };
}

function stickerFormatToExtension(formatType) {
    switch (formatType) {
        case StickerFormatType.Lottie:
            return 'json';
        case StickerFormatType.GIF:
            return 'gif';
        case StickerFormatType.APNG:
            return 'png';
        case StickerFormatType.PNG:
        default:
            return 'png';
    }
}

async function fetchStickerMetadata(client, stickerId) {
    if (!stickerId) return null;
    try {
        return await client.rest.get(Routes.sticker(stickerId));
    } catch (_) {
        return null;
    }
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

            const parsed = await parseEmojiInput(input, interaction.client);
            if (!parsed) {
                return interaction.reply({ content: 'Provide a custom emoji mention like <:name:id>, an emoji ID, or a valid CDN URL.', ephemeral: true });
            }

            const url = parsed.explicitUrl || buildEmojiCdnUrl(parsed.id, parsed.animated);
            const name = sanitizeEmojiName(overrideName || parsed.name || `emoji_${parsed.id}`, `emoji_${parsed.id}`);

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
            const rawIdOrUrl = interaction.options.getString('id_or_url');
            const fileAttachment = interaction.options.getAttachment('file');
            const nameInput = interaction.options.getString('name');
            const tagsInput = interaction.options.getString('tags');
            const descriptionInput = interaction.options.getString('description');

            const mention = extractStickerMention(rawIdOrUrl);
            const idOrUrl = mention?.id || rawIdOrUrl;

            if (!idOrUrl && !fileAttachment) {
                return interaction.reply({ content: 'Provide a sticker ID/URL or attach a sticker file.', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });

            let fileBuffer = null;
            let sourceUrl = null;
            let stickerMetadata = null;

            if (idOrUrl && /^[0-9]{15,25}$/.test(idOrUrl)) {
                stickerMetadata = await fetchStickerMetadata(interaction.client, idOrUrl);
            }

            try {
                if (fileAttachment?.url) {
                    const res = await fetch(fileAttachment.url);
                    if (!res.ok) throw new Error('Failed to download the attached file');
                    fileBuffer = await res.buffer();
                    sourceUrl = fileAttachment.url;
                } else if (idOrUrl) {
                    const preferredExt = stickerMetadata ? stickerFormatToExtension(stickerMetadata.format_type) : undefined;
                    const result = await fetchStickerBufferByIdOrUrl(idOrUrl, preferredExt);
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
                name = stickerMetadata?.name || mention?.name || (fromUrl ? `sticker_${fromUrl}` : 'sticker_clone');
            }
            name = sanitizeStickerName(name);

            let tags = tagsInput;
            if (!tags) {
                if (typeof stickerMetadata?.tags === 'string' && stickerMetadata.tags.trim().length) {
                    tags = stickerMetadata.tags.split(',').map(tag => tag.trim()).filter(Boolean).join(', ');
                }
            }
            if (!tags || !tags.trim()) tags = '🙂';

            const description = descriptionInput ?? (stickerMetadata?.description || undefined);

            const extensionMatch = sourceUrl?.match(/\.([a-z0-9]+)(?:\?.*)?$/i);
            let fileExtension = extensionMatch ? extensionMatch[1].toLowerCase() : undefined;
            if (!fileExtension && stickerMetadata) {
                fileExtension = stickerFormatToExtension(stickerMetadata.format_type);
            }
            if (!fileExtension) fileExtension = 'png';

            try {
                const created = await interaction.guild.stickers.create({
                    file: { name: `${name}.${fileExtension}`, data: fileBuffer },
                    name,
                    tags,
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
