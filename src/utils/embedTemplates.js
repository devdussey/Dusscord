const { EmbedBuilder } = require('discord.js');

const templates = {
    announcement: {
        name: 'announcement',
        description: 'Official announcement template',
        color: '#FFD700',
        emoji: '📢',
        defaultTitle: 'Important Announcement',
        defaultDescription: 'We have an important update to share with everyone!'
    },
    welcome: {
        name: 'welcome',
        description: 'Welcome new members template',
        color: '#00FF7F',
        emoji: '👋',
        defaultTitle: 'Welcome to the Server!',
        defaultDescription: 'Thanks for joining us! Make sure to read the rules and introduce yourself.'
    },
    poll: {
        name: 'poll',
        description: 'Poll/voting template',
        color: '#87CEEB',
        emoji: '📊',
        defaultTitle: 'Community Poll',
        defaultDescription: 'Cast your vote below! React with the corresponding emoji.'
    },
    event: {
        name: 'event',
        description: 'Event announcement template',
        color: '#FF6347',
        emoji: '🎉',
        defaultTitle: 'Upcoming Event',
        defaultDescription: 'Join us for an exciting community event!'
    },
    rules: {
        name: 'rules',
        description: 'Server rules template',
        color: '#DC143C',
        emoji: '📋',
        defaultTitle: 'Server Rules',
        defaultDescription: 'Please read and follow these rules to keep our community friendly and welcoming.'
    },
    info: {
        name: 'info',
        description: 'Information card template',
        color: '#4169E1',
        emoji: 'ℹ️',
        defaultTitle: 'Information',
        defaultDescription: 'Here\'s some important information for you to know.'
    },
    success: {
        name: 'success',
        description: 'Success message template',
        color: '#32CD32',
        emoji: '✅',
        defaultTitle: 'Success!',
        defaultDescription: 'Operation completed successfully!'
    },
    error: {
        name: 'error',
        description: 'Error message template',
        color: '#FF4500',
        emoji: '❌',
        defaultTitle: 'Error',
        defaultDescription: 'Something went wrong. Please try again.'
    },
    warning: {
        name: 'warning',
        description: 'Warning message template',
        color: '#FFA500',
        emoji: '⚠️',
        defaultTitle: 'Warning',
        defaultDescription: 'Please pay attention to this important notice.'
    }
};

function getEmbedTemplate(templateName, options = {}) {
    const template = templates[templateName.toLowerCase()];
    if (!template) return null;

    const embed = new EmbedBuilder()
        .setTitle(`${template.emoji} ${options.title || template.defaultTitle}`)
        .setDescription(options.description || template.defaultDescription)
        .setColor(template.color)
        .setTimestamp();

    if (options.user) {
        embed.setFooter({
            text: `Created by ${options.user.displayName}`,
            iconURL: options.user.displayAvatarURL()
        });
    }

    return embed;
}

function listTemplates() {
    return Object.values(templates).map(template => ({
        name: template.name,
        description: template.description
    }));
}

module.exports = { getEmbedTemplate, listTemplates };