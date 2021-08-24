const kifo = require("kifo");
const Discord = require("discord.js");
const ms = require("ms");

module.exports = {
	name: "epoch",
	description: "Easily convert dates to epoch and vice versa.",
	options: [
		{
			name: "date_to_epoch",
			type: "SUB_COMMAND",
			description: "Convert from date to epoch number (in seconds).",
			options: [
				// ? Can it be converted on-the-fly?
				// {
				// 	name: "type",
				// 	type: "STRING",
				// 	description: "What kind of time do you want to convert?",
				// 	required: true,
				// 	choices: [
				// 		{
				// 			name: "Time period",
				// 			value: "time_period",
				// 		},
				// 		{ name: "Date", value: "date" },
				// 	],
				// },
				{
					name: "input",
					type: "STRING",
					description:
						'Type either date like "1970-01-01T00:00:00Z", or time period "1h"',
					required: true,
				},
			],
		},
		{
			name: "epoch_to_date",
			type: "SUB_COMMAND",
			description: "Convert from epoch number (in seconds) to date.",
			options: [
				{
					name: "epoch",
					type: "INTEGER",
					required: true,
					description:
						"The number of seconds since 1970-01-01T00:00:00",
				},
			],
		},
		{
			name: "help",
			type: "SUB_COMMAND",
			description:
				"Receive link to guide that helps you use this command.",
		},
	],
	defaultPermission: true,
	guildonly: false,
	category: "UTILITY",
	perms: ["USE_APPLICATION_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		let subcmd = itr.options.data.find((d) => d.name === "help");
		if (subcmd !== undefined) {
			let btnRow = new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setLabel("Epoch Converter Guide")
					.setStyle("LINK")
					.setURL(
						"https://kifopl.github.io/kifo-clanker/guides/epoch"
					)
			);
			return itr.reply({
				components: [btnRow],
				embeds: [
					kifo.embed(
						"Click the button to learn more about epoch converter."
					),
				],
			});
		}
		subcmd = itr.options.data.find((d) => d.name === "date_to_epoch");
		if (subcmd !== undefined) {
			let input = subcmd.options.find((o) => o.name === "input").value;

			let epoch = Date.parse(input);

			if (!isNaN(epoch)) {
				epoch = Math.floor(epoch / 1000);
				return itr.reply({
					content: `${epoch}`,
					embeds: [
						kifo.embed(
							`\`${input}\` detected as __date__: <t:${epoch}>, <t:${epoch}:R>.\n\n **The epoch (in seconds) is:** \`${epoch}\`.\nFor easier copying, the epoch is also in the message content (above the embed).\n\nWrong output? Use ISO format, or read guide at \`/epoch help\`.`
						),
					],
				});
			}

			let timeperiod = ms(input);

			if (!isNaN(timeperiod)) {
				epoch = Math.floor((Date.now() + timeperiod) / 1000);
				return itr.reply({
					content: `${epoch}`,
					embeds: [
						kifo.embed(
							`\`${input}\` detected as __time period__: \`${ms(
								timeperiod,
								{ long: true }
							)}\`.\nThat's <t:${epoch}>, <t:${epoch}:R>.\n\n **The epoch (in seconds) is:** \`${epoch}\`.\nFor easier copying, the epoch is also in the message content (above the embed).\n\nWrong output? Use ISO 8601 format, or read guide at \`/epoch help\`.`
						),
					],
				});
			}
			return itr.reply({
				embeds: [
					kifo.embed(
						"Unrecognized output. For help, see `/epoch help`."
					),
				],
			});
		}
		subcmd = itr.options.data.find((d) => d.name === "epoch_to_date");
		if (subcmd !== undefined) {
			let epoch = subcmd.options.find((o) => o.name === "epoch").value;

			let date = new Date(epoch * 1000);

			return itr.reply({
				content: `${date.toISOString()}`,
				embeds: [
					kifo.embed(
						`Detected date: <t:${epoch}>, <t:${epoch}:R>.\n\n**The date (ISO 8601 format) is:** \`${date.toISOString()}\`.\nFor easier copying, the ISO 8601 date is also in message content (above the embed).\n\nWrong output? Use epoch in *seconds*, or read guide at \`/epoch help\`.`
					),
				],
			});
		}
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
