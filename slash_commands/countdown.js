const kifo = require("kifo");
const Discord = require("discord.js");
const { Permissions } = require("discord.js");

module.exports = {
	name: "countdown",
	description: "Count down to a given time, then send a message.",
	options: [
		{
			name: "epoch",
			type: "INTEGER",
			description:
				"The amount of seconds since 1970-01-01T00:00:00Z (use /epoch date_to_epoch to get the number)",
			required: true,
		},
		{
			name: "message",
			type: "STRING",
			description: "The message to send when the countdown ends.",
			required: true,
		},
	],
	defaultPermission: true,
	guildonly: true,
	category: "UTILITY",
	perms: ["USE_APPLICATION_COMMANDS", "MANAGE_MESSAGES"],

	//itr = interaction
	async execute(itr) {
		//* Perm check
		if (
			!itr.member
				.permissionsIn(itr.channel)
				.has(Permissions.FLAGS.MANAGE_MESSAGES)
		)
			return itr.reply({
				embeds: [
					kifo.embed(
						`You don't have \`MANAGE_MESSAGES\` permission!`
					),
				],
				ephemeral: true,
			});

		const replyComponents = new Discord.MessageActionRow().addComponents(
			new Discord.MessageButton()
				.setCustomId("countdown_on_yes")
				.setLabel("Accept")
				.setStyle("PRIMARY"),
			new Discord.MessageButton()
				.setCustomId("countdown_on_no")
				.setLabel("Cancel")
				.setStyle("SECONDARY")
		);
		const replyComponentsDisabled =
			new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setCustomId("countdown_on_yes")
					.setLabel("Accept")
					.setDisabled(true)
					.setStyle("PRIMARY"),
				new Discord.MessageButton()
					.setCustomId("countdown_on_no")
					.setLabel("Cancel")
					.setDisabled(true)
					.setStyle("SECONDARY")
			);

		let epoch = itr.options.data.find((o) => o.name === "epoch").value;
		let message = itr.options.data.find((o) => o.name === "message").value;

		let date = new Date(epoch * 1000);

		if (date.getTime() / 1000 < Date.now() / 1000 + 60)
			return itr.reply({
				embeds: [
					kifo.embed(
						`Please set the countdown end date in the future! (at least <t:${
							epoch + 60
						}>, <t:${epoch + 60}:R>`
					),
				],
			});

		let optionsEmbed = kifo
			.embed(
				`*Countdown by <@!${itr.member.id}>*`,
				"Please review the options:"
			)
			.addField("End time:", `<t:${epoch}>, <t:${epoch}:R>`)
			.addField("Message to send, when countdown ends:", message)
			.addField(
				"Are the options correct?",
				`If yes, please accept the options. Otherwise cancel.\n\n*(command automatically cancels within 30 seconds)*`
			);

		const { con } = require("../index.js");

		itr.reply({
			embeds: [optionsEmbed],
			components: [replyComponents],
		}).then(async () => {
			let itreply = await itr.fetchReply();
			itreply
				.awaitMessageComponent({ time: 30000 })
				.then((btnItr) => {
					if (btnItr.member !== itr.member) return;
					if (btnItr.customId === "countdown_on_yes") {
						con.query(
							/*sql*/
							`INSERT INTO countdown(GuildId, ChannelId, MessageId, Message, AuthorId, EndDate) VALUES (?,?,?,?,?,?)`,
							[
								itr.guildId,
								itr.channelId,
								itreply.id,
								message,
								itr.member.id,
								date,
							],
							function (err) {
								if (err) throw err;
								itr.editReply({
									components: [],
									embeds: [
										kifo.embed(
											`**__Countdown:__**\n<t:${epoch}>, <t:${epoch}:R>`,
											"Countdown started!"
										),
									],
								});
							}
						);
					}
				})
				.catch(() => {
					itr.editReply({ components: [replyComponentsDisabled] });
				});
		});
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
