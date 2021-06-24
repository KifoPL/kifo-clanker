const Discord = require("discord.js");

module.exports = {
	name: "ping",
	description: "This is a ping command :)",
	usage: ["`ping` - responds with a pong :)"],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args) {
		const Embed = new Discord.MessageEmbed()
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setColor("a039a0")
			.setTitle(
				`Command "${this.name.toUpperCase()}" issued by ${
					message.author.tag
				}`
			)
			.setDescription("...pong!");
		message.channel.send(Embed).catch();
	},
};
