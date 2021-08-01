const kifo = require("kifo");
const Discord = require("discord.js");

module.exports = {
	name: "ticket",
	description: "Create a ticket",
	options: [
		{
			name: "title",
			type: "STRING",
			description: "The problem, or question you have.",
			required: true,
		},
		{
			name: "description",
			type: "STRING",
			description:
				"Provide any additional information about your question/problem",
		},
	],
	defaultPermission: true,
	perms: ["USE_SLASH_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		const main = require(`../index.js`)
		const { ticketings } = require(`../index.js`);
		if (!ticketings.has(itr.channelId))
			return itr.reply({
				embeds: [
					kifo.embed("This channel does not have tickets enabled."),
				],
				ephemeral: true,
			});
		itr.defer({ ephemeral: true });
		let ticketing = ticketings.get(itr.channelId);
		let now = new Date(Date.now());
		let options = itr.options.data;
		let title = options.find((o) => o.name === "title").value;
		let thtitle = title.length > 50 ? `${title.slice(0, 47)}...` : title;
		let description = options.find((o) => o.name === "description")?.value;
		let ticket = kifo
			.embed(description ?? "", title)
			.setAuthor(`${itr.member.displayName}, ${itr.user.tag}`, itr.user.avatarURL({dynamic: true}))
			.setFooter(`asked by ${itr.user.tag} at ${now.toUTCString()}.`);
		itr.channel
			.send({content: `<@!${itr.member.id}>`, embeds: [ticket] })
			.then((msg) => {
				msg.startThread(
					thtitle,
					ticketing.DefaultArchive / 60 / 1000,
					"new ticket"
				)
					.then((thread) => {
						if (ticketing.DefaultSlowmode != 0)
							thread
								.setRateLimitPerUser(
									ticketing.DefaultSlowmode / 1000
								)
								.catch((err) => {main.log(err)});
						itr.editReply({
							embeds: [kifo.embed("Created a new ticket!")],
							ephemeral: true,
						});
					})
					.catch((err) => {
						itr.editReply({
							embeds: [kifo.embed("Could not create a ticket!")],
							ephemeral: false,
						});
						itr.channel
							.send({
								embeds: [
									kifo.embed(
										err,
										"ERROR while creating a ticket"
									),
								],
							})
							.catch(() => {});
					});
			})
			.catch((err) => {
				itr.editReply({
					embeds: [kifo.embed("Could not create a ticket!")],
					ephemeral: false,
				});
				itr.channel
					.send({
						embeds: [
							kifo.embed(`${err} ${err.stack}`, "ERROR while creating a ticket"),
						],
					})
					.catch(() => {});
			});
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
