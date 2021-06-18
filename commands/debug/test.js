module.exports = {
	name: "test",
	description:
		"This is just to test the functionality of the bot, as well as perms settings.",
	usage: "!kifo test",
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, Discord) {
		const embedreply = new Discord.MessageEmbed();
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
			return message.reply(embedreply);
		} else {
			embedreply.setDescription(`It works, regular person.`);
			return message.reply(embedreply);
		}
	},
};
