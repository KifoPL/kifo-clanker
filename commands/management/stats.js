const Discord = require("discord.js");
const kifo = require("kifo");
const main = require(`../../index.js`);
module.exports = {
	name: "stats",
	description: `Displays stats for given user, bot, role, server, message, ~~channel~~ (in development).\nIf the bot doesn't see some channels, stats ~~may~~ will be incorrect.`,
	usage: [
		"`stats` - shows stats of the server",
		"`stats <user>` - shows stats of specified user.",
		"`stats <role>` - shows stats of specified role.",
		"~~`stats <message_id>` - shows stats of specified message.~~ NOT IMPLEMENTED YET.",
		"`stats me` - shows your stats.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	async execute(message, args, prefix) {
		const list = require("./list.js");
		list.stats(message, args, prefix, false);
	},
};