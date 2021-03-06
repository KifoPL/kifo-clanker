module.exports = {
	name: "reverse",
	description: "This command reverses anything you type.",
	usage: ["`reverse <text>` - reverses the text."],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, Discord) {
		const kifo = require("kifo");
		if (!args[0]) return message.reply(kifo.embed(`Usage: ${this.usage}.`));

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
		var array = args.join(" ").split("");
		array.reverse();
		var output = array.join("");
		// if (
		// 	output.includes("@everyone") ||
		// 	output.includes("@here") ||
		// 	output.includes("<@&")
		// ) {
		// 	embedreply
		// 		.setTitle(`Error:`)
		// 		.setDescription(`if you think you're funny, think again.`);
		// 	return message.reply(embedreply).catch();
		// }
		embedreply.setDescription(output);
		message.channel.send(embedreply).catch();
	},
};
