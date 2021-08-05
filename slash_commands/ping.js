const kifo = require("kifo")
const Discord = require("discord.js");

module.exports = {
	name: "ping",
	description: "...pong?",
	options: [
		{
			name: "reply",
			type: "STRING",
			description: "What do you want me to reply with?",
		},
	],
	category: "DEBUG",
	defaultPermission: true,
	guildonly: false,
	perms: ["USE_SLASH_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		if (itr.options.data.length > 0) {
			itr.reply({ embeds: [kifo.embed(`Pong!\n${itr.options.data[0].value}`)], ephemeral: true })
		}
		else itr.reply({ embeds: [kifo.embed("Pong!")], ephemeral: true })
	},
	async button(itr) {
	},
	async selectMenu(itr) {
	}
};
