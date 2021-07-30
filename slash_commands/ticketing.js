const kifo = require("kifo");
const Discord = require("discord.js");

module.exports = {
	name: "ticketing",
	description: "Set up ticketing system in a channel.",
	options: [
		{
			name: "on",
			type: "SUB_COMMAND",
			description: "Turn on ticketing system.",
			options: [
				{
					name: "visibility",
					description:
						"Should tickets be public, allowing everyone to answer questions, or private?",
					type: "STRING",
					required: true,
					choices: [
						{
							name: "Public",
							value: "Public",
						},
						{
							name: "Private",
							value: "Private",
						},
					],
				},

				{
					name: "archiving",
					description:
						"After what time of inactivity should threads be archived?",
					type: "STRING",
					required: true,
					choices: [
						{ name: "1 hour", value: "1h" },
						{ name: "1 day", value: "1h" },
						{ name: "3 days", value: "3d" },
						{ name: "1 week", value: "1w" },
					],
				},
				{
					name: "slowmode",
					description:
						"What should be the default slow-mode for tickets?",
					type: "STRING",
					required: false,
					choices: [
						{ name: "5s", value: "5s" },
						{ name: "10s", value: "10s" },
						{ name: "15s", value: "15s" },
						{ name: "30s", value: "30s" },
						{ name: "1m", value: "1m" },
						{ name: "2m", value: "2m" },
						{ name: "5m", value: "5m" },
						{ name: "10m", value: "10m" },
						{ name: "15m", value: "15m" },
						{ name: "30m", value: "30m" },
						{ name: "1h", value: "1h" },
						{ name: "2h", value: "2h" },
						{ name: "6h", value: "6h" },
					],
				},
			],
		},
		{
			name: "off",
			description: "Turn off ticketing system.",
			type: "SUB_COMMAND",
		},
		{
			name: "list",
			description: "List all channels with ticketing system enabled.",
			type: "SUB_COMMAND",
		},
	],
	defaultPermission: true,
	perms: ["MANAGE_CHANNELS", "MANAGE_THREADS"],

	//itr = interaction
	async execute(itr) {
		console.log(itr);
		console.log("OPTIONS DATA -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=")
		console.log(itr.options.data)
		itr.reply({
			embeds: [
				kifo.embed(
					"How's it going my brother? Welcome to the ticketing command lol"
				),
			],
			ephemeral: true,
		});
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) { },
};
