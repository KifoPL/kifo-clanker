const kifo = require("kifo");
const Discord = require("discord.js");
const main = require("../index.js")

module.exports = {
	name: "guide",
	description:
		"Receive a link for the command list, or guide regarding a specific topic.",
	options: [
		{
			name: "choice",
			type: "STRING",
			description: "Select a topic, which you want to learn about.",
			choices: [
				{ name: "Slash commands", value: "slash" },
				{ name: "Context menus", value: "contextmenus" },
				{ name: "Epoch converter", value: "epoch" },
				{ name: "Using /ticket", value: "ticket" },
				{ name: "Ticketing system", value: "ticketing" },
				{ name: "Auto-threading system", value: "autothreading" },
			],
		},
	],
	category: "HELP",
	defaultPermission: true,
	guildonly: false,
	perms: ["USE_APPLICATION_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		let options = itr.options.data;
		let choice = options.find((o) => o.name === "choice");
		if (choice != null) {
			let text = this.options[0].choices.find(
				(c) => c.value === choice.value
			).name;
			let actionRow = new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setStyle("LINK")
					.setLabel(text)
					.setURL(
						`https://kifopl.github.io/kifo-clanker/docs/guides/${choice.value}`
					)
			);
			itr.reply({
				embeds: [
					kifo.embed(
						`Click the button to learn about **\`${text}\`**!`
					),
				],
				components: [actionRow],
				ephemeral: true,
			});
		} else {
			let actionRow = new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setStyle("LINK")
					.setLabel("Guide List")
					.setURL(`https://kifopl.github.io/kifo-clanker/guideList`)
			);
			itr.reply({
				embeds: [
					kifo.embed(`Click the button to read the guide list!`),
				],
				components: [actionRow],
				ephemeral: true,
			});
		}
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
