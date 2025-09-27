const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../utils/ownerIds');
const {
  MAX_PERSONA_LENGTH,
  getPersona,
  setPersona,
  clearPersona,
} = require('../utils/analysisConfigStore');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analysisconfig')
    .setDescription('Owner-only: manage the analysis persona for this guild')
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Set the analysis persona text used for AI analysis')
        .addStringOption((opt) =>
          opt
            .setName('persona')
            .setDescription('Persona/system prompt text (max 2000 characters)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('show')
        .setDescription('Show the currently configured analysis persona')
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Clear the saved analysis persona and use the default')
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'Use this command inside a server.', ephemeral: true });
    }

    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: 'This command is restricted to bot owners.', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const persona = interaction.options.getString('persona', true);
      try {
        const saved = await setPersona(interaction.guildId, persona);
        return interaction.reply({
          content: `Analysis persona updated (length: ${saved.length}/${MAX_PERSONA_LENGTH}).`,
          ephemeral: true,
        });
      } catch (err) {
        return interaction.reply({
          content: `Could not update persona: ${err.message}`,
          ephemeral: true,
        });
      }
    }

    if (sub === 'show') {
      const persona = getPersona(interaction.guildId);
      if (!persona) {
        return interaction.reply({
          content: 'No custom persona configured. The default system prompt will be used.',
          ephemeral: true,
        });
      }
      const preview = persona.length > 1900 ? `${persona.slice(0, 1900)}…` : persona;
      return interaction.reply({
        content: `**Current analysis persona:**\n${preview}`,
        ephemeral: true,
      });
    }

    if (sub === 'clear') {
      const removed = await clearPersona(interaction.guildId);
      if (removed) {
        return interaction.reply({
          content: 'Analysis persona cleared. The default system prompt will be used.',
          ephemeral: true,
        });
      }
      return interaction.reply({
        content: 'There was no custom persona configured.',
        ephemeral: true,
      });
    }

    return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
  },
};
