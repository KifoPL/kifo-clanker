const Discord = require("discord.js");
module.exports = {
	name: "cringe",
	description: `Express your feelings to another discord user with this beautiful poem.`,
	options: [
		{
			name: "user",
			type: "USER",
			description: "direct your feelings towards the user.",
		},
	],
	usage: ["`cringe <optional_user>` - informs user of their cringe level."],
	guildonly: true,
	category: "FUN",
	perms: ["USE_APPLICATION_COMMANDS"],
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
			"Roses are red,\nViolets are blue,\nYou are cringe.\nSeriously. You're cringe.";
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
