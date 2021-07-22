const Discord = require("discord.js");
module.exports = {
	name: "test",
	description:
		"This is just to test the functionality of the bot, as well as perms settings.",
	usage: [
		"`test` - tests if the bot is online and checks for various stuff to find potential issues.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args) {
		const embedreply = new Discord.MessageEmbed();
		const ms = require("ms");
		embedreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(
				`Command "${this.name.toUpperCase()}" issued by ${
					message.author.tag
				}`
			);
		if (message.member.permissions.has("ADMINISTRATOR")) {
			embedreply.setDescription(
				`Works fine, Mr. Admin ${message.author}!`
			);
			message.channel.stopTyping(true);
			return message.reply(embedreply);
		} else {
			embedreply.setDescription(`It works, regular person.`);
			message.channel.stopTyping(true);
			return message.reply(embedreply);
		}
	},
};
