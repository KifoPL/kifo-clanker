module.exports = {
	name: "test",
	description:
		"This is just to test the functionality of the bot, as well as perms settings.",
	usage: ["`test` - tests if the bot is online and checks for various stuff to find potential issues."],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, Discord) {
		const embedreply = new Discord.MessageEmbed();
		const ms = require("ms")
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
			if (args[0] != null) {
				if (!isNaN(ms(args[0]))) {
					let time = ms(args[0])
					let now = new Date(Date.now());
					//let end = new Date((now.getTime() + ms(time)));
					let end = new Date(now.getTime() + time);
					console.log("now")
					console.log(now)
					console.log("time")
					console.log(time)
					console.log("end")
					console.log(end)
				}
			}
		if (message.member.permissions.has("ADMINISTRATOR")) {
			embedreply.setDescription(
				`Works fine, Mr. Admin ${message.author}!`
			);
			return message.reply(embedreply);
		} else {
			embedreply.setDescription(`It works, regular person.`);
			return message.reply(embedreply);
		}
	},
};
