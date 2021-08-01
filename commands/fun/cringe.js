const Discord = require("discord.js");
module.exports = {
	name: "cringe",
	description: `Express your feelings to another discord user with this beautiful poem.`,
	usage: ["`cringe <optional_user>` - informs user of their cringe level."],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args) {
		//THIS IS A TEMPLATE
		const kifo = require("kifo");
		const embedreply = new Discord.MessageEmbed();
		embedreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(
				`Command "${this.name.toUpperCase()}" issued by ${message.author.tag
				}`
			);

		let userping = "";

		let reply =
			"Roses are red,\nViolets are blue,\nYou are cringe.\nSeriously. You're cringe.";
		if (args[1] != undefined) {
			embedreply.setTitle("Error:");
			embedreply.setDescription("Too many arguments!");
			return message.reply({ embeds: [embedreply] });
		}
		if (args[0]) {
			if (message.mentions.users.firstKey() != undefined) {
				if (
					message.mentions.users.firstKey() == 289119054130839552 ||
					message.mentions.users.firstKey() == 795638549730295820
				) {
					embedreply
						.setTitle(
							`You dare use my own spell against me, ${message.author.tag}?`
						)
						.setImage(
							`https://media1.tenor.com/images/72623e4b02895f3c7b623f2222268908/tenor.gif`
						);
					return message.reply({ embeds: [embedreply] });
				}
				userping = `${args[0]}`;
			} else if (!isNaN(args[0])) {
				if (!message.guild.members.resolve(args[0]))
					return message.reply({ embeds: [kifo.embed("user not found.")] });
				else {
					if (
						args[0] == 289119054130839552 ||
						args[0] == 795638549730295820
					) {
						embedreply
							.setTitle(
								`You dare use my own spell against me, ${message.author.tag}?`
							)
							.setImage(
								`https://media1.tenor.com/images/72623e4b02895f3c7b623f2222268908/tenor.gif`
							);
						return message.reply({ embeds: [embedreply] });
					}
					userping = "<@" + args[0] + ">\n";
				}
			}
		}
		embedreply.setDescription(reply);
		message.channel.send({ content: userping, embeds: [embedreply] }).catch(() => { });
	},
};
