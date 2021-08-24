const kifo = require("kifo");
const Discord = require("discord.js");

module.exports = {
	name: "countdown",
	description: "Count down to a given time, then send a message.",
	options: [
		{
			name: "epoch",
			type: "INTEGER",
			description:
				"The amount of seconds since 1970-01-01T00:00:00Z (use /epoch to get the number)",
		},
	],
	defaultPermission: true,
	guildonly: true,
	category: "UTILITY",
	perms: ["USE_APPLICATION_COMMANDS", "MANAGE_MESSAGES"],

	//itr = interaction
	async execute(itr) {
		itr.reply({
			embeds: [kifo.embed(`How's it going my brother?`)],
			ephemeral: true,
		});
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
