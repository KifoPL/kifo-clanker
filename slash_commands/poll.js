const Discord = require("discord.js");
module.exports = {
	name: "poll",
	description: "This command allows you to quickly create a poll.",
	usage: [
		"`poll <time_period> <description>\n<option 1>\n<option 2>\n...` - sends a poll with a `description`, that will automatically show results after `time period`. Up to 10 options.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args) {
		const kifo = require("kifo");
		console.log(args)
	},
};
