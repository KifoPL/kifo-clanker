const kifo = require("kifo");
const Discord = require("discord.js");

module.exports = {
	name: "poll",
	description: "Create a poll.",
	options: [
		{
			name: "question",
			type: "STRING",
			description: "Ask the question or an opinion",
			required: true,
		},
		{
			name: "one",
			type: "STRING",
			description: "Option 1",
			required: true,
		},
		{
			name: "two",
			type: "STRING",
			description: "Option 2",
			required: true,
		},
		{
			name: "three",
			type: "STRING",
			description: "Option 3",
		},
		{
			name: "four",
			type: "STRING",
			description: "Option 4",
		},
		{
			name: "five",
			type: "STRING",
			description: "Option 5",
		},
		{
			name: "six",
			type: "STRING",
			description: "Option 6",
		},
		{
			name: "seven",
			type: "STRING",
			description: "Option 7",
		},
		{
			name: "eight",
			type: "STRING",
			description: "Option 8",
		},
		{
			name: "nine",
			type: "STRING",
			description: "Option 9",
		},
		{
			name: "ten",
			type: "STRING",
			description: "Option 10",
		},
	],
	defaultPermission: true,
	perms: ["USE_SLASH_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		const main = require(`../index.js`);
		if (
			!itr.guild.me
				.permissionsIn(itr.channel)
				.has(Discord.Permissions.FLAGS.ADD_REACTIONS)
		)
			return itr.reply({
				embeds: [
					kifo.embed("I don't have `ADD_REACTIONS` permission!"),
				],
			});
		let reactions = [
			"1️⃣",
			"2️⃣",
			"3️⃣",
			"4️⃣",
			"5️⃣",
			"6️⃣",
			"7️⃣",
			"8️⃣",
			"9️⃣",
			"🔟",
		];
		let options = itr.options.data.map((x) => x);
		let question = options.shift();
		let rEmbed = kifo.embed(
			"React to the option you choose!",
			question.value
		);
		for (i = 0; i < options.length; i++) {
			rEmbed.addField(options[i].value, `React with ${reactions[i]}!`);
		}
		itr.reply({
			embeds: [rEmbed],
		}).catch((err) => {
			itr.reply({ embeds: [kifo.embed(err)] }).catch(() => {});
		});
		await itr.fetchReply().then((itreply) => {
			for (i = 0; i < options.length; i++) {
				itreply.react(reactions[i]).catch(() => {});
			}
		});
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
