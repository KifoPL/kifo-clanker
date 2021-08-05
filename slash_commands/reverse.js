const Discord = require("discord.js");
module.exports = {
	name: "reverse",
	description: "This command reverses anything you type.",
	options: [
		{ name: "text", type: "STRING", description: "The text to reverse" },
		{
			name: "silent",
			type: "BOOLEAN",
			description:
				"Whether to show the result to only you, or everyone. False by default.",
		},
	],
	usage: ["`reverse <text>` - reverses the text."],
	guildonly: false,
	category: "FUN",
	perms: ["USE_SLASH_COMMANDS"],
	execute(itr) {
		const kifo = require("kifo");
		const text = itr.options.data.find(o => o.name === "text").value;
		const silent = itr.options.data.find(o => o.name === "silent")?.value ?? false;

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
					itr.user.tag
				}`
			);
		var output = text.split("").reverse().join("");
		embedreply.setDescription(output);
		itr.reply({ embeds: [embedreply], ephemeral: silent }).catch();
	},
};
