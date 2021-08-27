const kifo = require("kifo");
const Discord = require("discord.js");

module.exports = {
	name: "test",
	description: "test out if the `/` commands work properly.",
	options: [
		{
			name: "input",
			type: "STRING",
			description: "The text to return.",
		},
		{
			name: "input2",
			type: "STRING",
			description: "The text to return.",
		},
	],
	defaultPermission: true,
	guildonly: false,
	category: "DEBUG",
	perms: ["USE_APPLICATION_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		let input = itr.options.data.find((o) => o.name == "input")?.value;
		let input2 = itr.options.data.find((o) => o.name == "input2")?.value;

		if (input != null) {
			itr.reply({
				embeds: [
					kifo.embed(
						`\n- input: \`${
							input ?? `not passed`
						}\`,\n- input2: \`${input2 ?? `not passed`}\``,
						`Your arguments:`
					),
				],
				ephemeral: true,
			});
		}
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
