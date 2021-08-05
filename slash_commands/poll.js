const kifo = require("kifo");
const Discord = require("discord.js");
const ms = require("ms");

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
			name: "timeout",
			type: "STRING",
			description:
				'When do you want to calculate results? "0", if never.',
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
	category: "UTILITY",
	defaultPermission: true,
	guildonly: true,
	perms: ["USE_SLASH_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		const main = require(`../index.js`);
		if (
			!itr.guild.me
				.permissionsIn(itr.channel)
				.has(Discord.Permissions.FLAGS.ADD_REACTIONS)
		)
			return itr.editReply({
				embeds: [
					kifo.embed("I don't have `ADD_REACTIONS` permission!"),
				],
			});
		await itr.defer();
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
		let time = options.shift().value;
		if (time != 0) {
			if (isNaN(ms(time)))
				return itr.editReply({
					embeds: [
						kifo.embed(
							"Incorrect timeout! If you don't want any timeout, simply type `0`."
						),
					],
					ephemeral: true,
				});
			if (ms(time) < 1000 * 60 || ms(time) > ms("1y"))
				return itr.editReply({
					embeds: [
						kifo.embed(
							"Incorrect timeout! Set it between `1 minute` and `1 year`."
						),
					],
					ephemeral: true,
				});
		}
		let now = new Date(Date.now());
		let end;
		if (time != 0) end = new Date(now.getTime() + ms(time));
		else end = null;
		let rEmbed = kifo.embed(
			`React to the option you choose!${
				end != null
					? `\nPoll ends at <t:${Math.floor(
							end.getTime() / 1000
					  )}>, <t:${Math.floor(end.getTime() / 1000)}:R>`
					: ""
			}`,
			question.value
		);
		for (i = 0; i < options.length; i++) {
			rEmbed.addField(options[i].value, `React with ${reactions[i]}!`);
		}
		itr.editReply({
			embeds: [rEmbed],
		}).catch((err) => {
			itr.editReply({ embeds: [kifo.embed(err)] }).catch(() => {});
		});

		await itr.fetchReply().then((itreply) => {
			if (end != null) {
				main.con.query(
					"INSERT INTO polls (GuildId, ChannelId, MessageId, EndTime)  VALUES (?, ?, ?, ?)",
					[itr.guildId, itr.channelId, itreply.id, end],
					function (err) {
						if (err) throw err;
					}
				);
			}
			for (i = 0; i < options.length; i++) {
				itreply.react(reactions[i]).catch(() => {});
			}
		});
	},
	async button(itr) {
		itr.editReply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
