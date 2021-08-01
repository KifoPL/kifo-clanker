const Discord = require("discord.js");
module.exports = {
	name: "stfu",
	description: `This is an eloquent way to say "Thank you for this conversation we've had".`,
	usage: [
		"`stfu <optional_user>` - ask someone to lower their voice to the sub-audible level in an elegant manner.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args) {
		const kifo = require("kifo");
		//THIS IS A TEMPLATE
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

		let userping = "";

		let reply =
			"I honestly don't even know where to start, but what you're doing is incredibly annoying, needless, and generally speaking, stupid. Continuing to do so may result in permanent damage to your brain cells. As I care for your health, please stop doing this.";
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
					return message.reply({
						embeds: [kifo.embed("user not found.")],
					});
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
		message.reply({ content: userping, embeds: [embedreply] }).catch();
	},
};
