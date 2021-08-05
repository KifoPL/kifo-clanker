const kifo = require("kifo")
const Discord = require("discord.js");

module.exports = {
	name: "test",
	description: "test out if the `/` commands work properly.",
	options: [
		{
			name: "input",
			type: "STRING",
			description: "The text to return.",
		},
	],
	defaultPermission: true,
	guildonly: false,
	category: "DEBUG",
	perms: ["USE_SLASH_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		itr.reply({ embeds: [kifo.embed(`How's it going my brother?`)], ephemeral: true })
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] })
	},
	async selectMenu(itr) {

	}
};
