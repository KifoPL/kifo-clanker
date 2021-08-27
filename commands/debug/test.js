const Discord = require("discord.js");
const api = require("detectlanguage");
const kifo = require("kifo");
module.exports = {
	name: "test",
	description: "Test how your arguments are passed.",
	usage: ["`test <args>` - showcase of how the arguments are passed."],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args) {
		return message.reply({
			embeds: [
				kifo.embed(
					`- \`${args.join(`\`,\n- \``)}\``,
					`Your arguments:`
				),
			],
		});
	},
};
