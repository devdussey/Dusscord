// Slash command to set/reset the server's default embed colour.


const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require("discord.js");
const { setDefaultColour, parseColour, toHex6 } = require("../../utils/guildColourStore");


module.exports = {
data: new SlashCommandBuilder()
.setName("setdefaultcolour")
.setDescription("Set this server's default embed colour (#hex or reset)")
.addStringOption((opt) =>
opt
.setName("colour")
.setDescription("#RGB, #RRGGBB, 0xRRGGBB or 'reset'")
.setRequired(true)
)
.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), // why: avoid random users changing server-wide style


async execute(interaction) {
if (!interaction.inGuild()) return interaction.reply({ content: "Use this in a server.", ephemeral: true });
const raw = interaction.options.getString("colour", true);


try {
const parsed = parseColour(raw); // null if reset/none/default
if (parsed === null) {
await setDefaultColour(interaction.guildId, null);
return interaction.reply({ content: "Default embed colour reset to fallback.", ephemeral: true });
}
await setDefaultColour(interaction.guildId, parsed);
const embed = new EmbedBuilder()
.setTitle("Default embed colour updated")
.setDescription(`Saved: **${toHex6(parsed)}**`)
.setColor(parsed);
return interaction.reply({ embeds: [embed], ephemeral: true });
} catch (err) {
return interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
}
},
};




// End of file
