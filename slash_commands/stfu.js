const Discord = require("discord.js");
module.exports = {
	name: "stfu",
	description: `This is an eloquent way to say "Thank you for this conversation we've had".`,
	options: [
		{
			name: "user",
			description:
				"Ask someone to lower their voice to the sub-audible level in an elegant manner.",
			type: "USER",
		},
	],
	usage: [
		"`stfu <optional_user>` - ask someone to lower their voice to the sub-audible level in an elegant manner.",
	],
	guildonly: true,
	category: "FUN",
	perms: ["USE_SLASH_COMMANDS"],
	execute(itr) {
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
				`Command "${this.name.toUpperCase()}" issued by ${itr.user.tag}`
			);

		let member = itr.options.data.find((o) => o.name === "user")?.member;
		let userping = ``;
		if (member != null) userping = `<@!${member.id}>`;

		let reply =
			"I honestly don't even know where to start, but what you're doing is incredibly annoying, needless, and generally speaking, stupid. Continuing to do so may result in permanent damage to your brain cells. As I care for your health, please stop doing this.";
		if (member != null) {
			if (
				member.id === "289119054130839552" ||
				member.id == "795638549730295820"
			) {
				embedreply
					.setTitle(
						`You dare use my own spell against me, ${itr.member.displayName}?`
					)
					.setImage(
						`https://media1.tenor.com/images/72623e4b02895f3c7b623f2222268908/tenor.gif`
					);
				return itr.reply({ embeds: [embedreply] });
			}
		}
		embedreply.setDescription(reply);
		if (userping != "") {
			itr.reply({ content: userping, embeds: [embedreply] }).catch(
				() => {}
			);
		} else itr.reply({ embeds: [embedreply] }).catch(() => {});
	},
};
