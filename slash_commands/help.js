const kifo = require("kifo")
const Discord = require("discord.js");

module.exports = {
	name: "help",
	description: "Receive link for slash commands list.",
	defaultPermission: true,
	perms: ["USE_SLASH_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		let actionRow = new Discord.MessageActionRow().addComponents(
			new Discord.MessageButton()
			.setStyle("LINK")
			.setLabel("Command List")
			.setURL(`https://kifopl.github.io/kifo-clanker/commandList.html#list-of-slash-commands-used-with-`)
		)
		itr.reply({ embeds: [kifo.embed(`Click the button to read the command list!`)], components: [actionRow], ephemeral: true })
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] })
	},
	async selectMenu(itr) {

	}
};
