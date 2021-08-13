const kifo = require("kifo");
const Discord = require("discord.js");
const { Permissions } = require("discord.js");
const ms = require("ms");
const timer = (ms) => new Promise((res) => setTimeout(res, ms));

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
							value: "public",
						},
						{
							name: "Private",
							value: "private",
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
		{
			name: "help",
			description:
				"Send a link with very detailed information regarding ticketing system.",
			type: "SUB_COMMAND",
		},
	],
	defaultPermission: true,
	guildonly: true,
	category: "MANAGEMENT",
	perms: ["USE_APPLICATION_COMMANDS", "MANAGE_CHANNELS", "MANAGE_THREADS"],

	//itr = interaction
	async execute(itr) {
		const { con, ticketings } = require("../index.js");
		const main = require("../index.js");

		let subcmd = itr.options.data.find((d) => d.name === "help");
		if (subcmd !== undefined) {
			let btnRow = new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setLabel("Ticketing Guide")
					.setStyle("LINK")
					.setURL(
						"https://kifopl.github.io/kifo-clanker/guides/ticketing"
					)
			);
			itr.reply({
				components: [btnRow],
				embeds: [
					kifo.embed(
						"Click the button to learn more about ticketing system."
					),
				],
				ephemeral: true,
			}).catch(() => {});
			return;
		}

		subcmd = itr.options.data.find((d) => d.name === "on");
		if (subcmd !== undefined) {
			if (
				itr.channel.type !== "GUILD_TEXT" &&
				itr.channel.type !== "GUILD_NEWS"
			) {
				itr.reply({
					embeds: [
						kifo.embed(
							"Please use this command only in text channels (not threads)."
						),
					],
				});
				return;
			}
			if (ticketings.has(itr.channelId))
				return itr.reply({
					embeds: [
						kifo.embed(
							"There is already ticketing system enabled in this channel."
						),
					],
					ephemeral: true,
				});

			let options = subcmd.options;
			let visibility = options.find((o) => o.name === "visibility").value;
			let archiving = options.find((o) => o.name === "archiving").value;
			let slowmode = options.find((o) => o.name === "slowmode")?.value;
			let tier = itr.guild.premiumTier; //NONE | TIER_1 | TIER_2 | TIER_3

			//PERM CHECK
			if (
				!itr.member
					?.permissionsIn(itr.channel)
					.has(Permissions.FLAGS.MANAGE_CHANNELS)
			)
				return itr.reply({
					embeds: [
						kifo.embed(
							"You don't have `MANAGE_CHANNELS` permission!"
						),
					],
					ephemeral: true,
				});
			if (
				!itr.member
					?.permissionsIn(itr.channel)
					.has(Permissions.FLAGS.MANAGE_THREADS)
			)
				return itr.reply({
					embeds: [
						kifo.embed(
							"You don't have `MANAGE_THREADS` permission!"
						),
					],
					ephemeral: true,
				});
			if (
				!itr.guild?.me
					.permissionsIn(itr.channel)
					.has(Permissions.FLAGS.MANAGE_THREADS)
			)
				return itr.reply({
					embeds: [
						kifo.embed("I don't have `MANAGE_THREADS` permission!"),
					],
					ephemeral: true,
				});
			if (
				!itr.guild?.me
					.permissionsIn(itr.channel)
					.has(Permissions.FLAGS.MANAGE_CHANNELS)
			)
				return itr.reply({
					embeds: [
						kifo.embed(
							"I don't have `MANAGE_CHANNELS` permission!"
						),
					],
					ephemeral: true,
				});

			if (
				!itr.guild?.me
					.permissionsIn(itr.channel)
					.has(Permissions.FLAGS.MANAGE_MESSAGES)
			)
				return itr.reply({
					embeds: [
						kifo.embed(
							"I don't have `MANAGE_MESSAGES` permission!"
						),
					],
					ephemeral: true,
				});

			if (tier == "NONE") {
				if (archiving == "3d" || archiving == "1w")
					return itr.reply({
						embeds: [
							kifo.embed(
								`${
									archiving == "3d"
										? "The server must have at least `TIER_1` worth of boosts to archive after 3 days."
										: "The server must have at least `TIER_2` worth of boosts to archive after a week."
								}`
							),
						],
						ephemeral: true,
					});
				if (visibility == "private")
					return itr.reply({
						embeds: [
							kifo.embed(
								"The server must have at least `TIER_2` worth of boosts to enable private tickets."
							),
						],
						ephemeral: true,
					});
			} else if (tier == "TIER_1") {
				if (archiving == "1w")
					return itr.reply({
						embeds: [
							kifo.embed(
								"The server must have at least `TIER_2` worth of boosts to archive after a week."
							),
						],
						ephemeral: true,
					});
				if (visibility == "private")
					return itr.reply({
						embeds: [
							kifo.embed(
								"The server must have at least `TIER_2` worth of boosts to enable private tickets."
							),
						],
						ephemeral: true,
					});
			}

			let embedReply = kifo
				.embed(
					"Please make sure that the following settings are correct:",
					"Ticketing settings:"
				)
				.addFields([
					{
						name: "Ticket visibility:",
						value: visibility,
						inline: true,
					},
					{
						name: "Archiving:",
						value: `After ${ms(ms(archiving), {
							long: true,
						})} of inactivity.`,
						inline: true,
					},
					{
						name: "Slowmode:",
						value: slowmode ?? "none",
						inline: true,
					},
				]);

			const replyComponents =
				new Discord.MessageActionRow().addComponents(
					new Discord.MessageButton()
						.setCustomId("ticketing_on_yes")
						.setLabel("Settings are correct")
						.setStyle("PRIMARY"),
					new Discord.MessageButton()
						.setCustomId("ticketing_on_no")
						.setLabel("Cancel Ticketing")
						.setStyle("SECONDARY")
				);
			const yesComponents = new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setCustomId("ticketing_on_yes_msg_yes")
					.setLabel("Yes please!")
					.setStyle("PRIMARY"),
				new Discord.MessageButton()
					.setCustomId("ticketing_on_yes_msg_no")
					.setLabel("I'll do it myself.")
					.setStyle("SECONDARY")
			);

			itr.reply({
				embeds: [embedReply],
				components: [replyComponents],
			}).then(async () => {
				let itreply = await itr.fetchReply();
				itreply
					.awaitMessageComponent({ time: 15000 })
					.then((btnItr) => {
						if (btnItr.member !== itr.member) return;
						if (btnItr.customId == "ticketing_on_yes") {
							con.query(
								"INSERT INTO ticketing (GuildId , ChannelId , ArePublic , DefaultSlowmode , DefaultArchive) VALUES (?, ?, ?, ?, ?)",
								[
									itr.guildId,
									itr.channelId,
									visibility === "public" ? true : false,
									ms(slowmode ?? "0ms"),
									ms(archiving),
								],
								function (err) {
									if (err) throw err;
									ticketings.set(itr.channelId, {
										ChannelId: itr.ChannelId,
										ArePublic:
											visibility === "public"
												? true
												: false,
										DefaultArchive: archiving,
										DefaultSlowmode: slowmode ?? null,
									});
								}
							);
							embedReply.setTitle("One last step!");
							embedReply.setDescription(
								"Would you mind if I post a message explaining ticket system, or will you do it yourself?"
							);
							btnItr
								.update({
									embeds: [embedReply],
									components: [yesComponents],
								})
								.then(() => {
									btnItr.message
										.awaitMessageComponent({ time: 15000 })
										.then((btnItrOnYes) => {
											if (
												btnItrOnYes.member !==
												itr.member
											)
												return;
											if (
												btnItrOnYes.customId ==
												"ticketing_on_yes_msg_yes"
											) {
												//Send a cool message regarding how the ticket system work
												ticketingEmbed = kifo.embed(
													`**This channel has __\`tickets\`__ enabled**.
1. If you have a question or a problem that needs solving, type \`/ticket\` to create a ticket.
2. Then, in \`title\`, ask the question, or state the problem.
3. If you need to provide additional details, that's what \`description\` is for!

**Friendly tips:** *(not required, but they definitely help getting the answer you're looking for!)*
- **Try to find an answer yourself** *(90% of the questions have their answer somewhere in the rules, or other generally accessible channels)*.
- **Keep your \`titles\` brief** *(perfect title is straight to the point - people love answering simple questions, so try to make it look simple)*.
- **Skip all unnecessary details** *(people often find it disappointing when a giant wall of text leads to small and easy question)*.
- **Describe the origin of your problem/question** *(What topic/category brought you to this channel? Where did you expect to find an answer?)*.

And most important one: __**Don't forget to thank the person for answering!**__ They didn't have to, yet they *chose* to help you. Share kindness everywhere you can.\n\n> *Still confused? Type \`/guide Using /ticket\` for even more details.*`,
													"How to use this channel?"
												);
												itr.channel.send({
													embeds: [ticketingEmbed],
												});
												timer(3000).then((_) => {
													itr.deleteReply();
												});
											} else if (
												btnItrOnYes.customId ==
												"ticketing_on_yes_msg_no"
											) {
												throw new Error();
											}
										})
										.catch(() => {
											embedReply
												.setTitle(
													"Ticketing system is turned on!"
												)
												.setDescription(
													"*This message will be deleted in 30 seconds.*"
												);
											itr.editReply({
												embeds: [embedReply],
												components: [],
											}).catch((err) => {
												console.error(err);
											});
											timer(30000).then((_) => {
												itr.deleteReply().catch(
													() => {}
												);
											});
										})
										.finally(() => {
											//send ephemeral follow up message asking to check permissions for the channel,
											//@everyone should have X SEND_MESSAGES and V USE_APPLICATION_COMMANDS and V USE_PRIVATE_THREADS or V USE_PUBLIC_THREADS
											let permsEmbed = kifo
												.embed(
													``,
													"Your channel should have these permissions:"
												)
												.addFields([
													{
														name: `@everyone perms:`,
														value: "- `ALLOW`: `VIEW_CHANNEL`, `USE_APPLICATION_COMMANDS`, `USE_PUBLIC_THREADS` or `USE_PRIVATE_THREADS` (see note below).",
													},
													{
														name: `Moderators and Kifo Clanker:`,
														value: "- `ALLOW`: `SEND_MESSAGES`, `MANAGE_CHANNELS`, `MANAGE_THREADS`, `USE_APPLICATION_COMMANDS`.",
													},
													{
														name: "NOTE:",
														value: "If you want to set `Public` visibility, users will need `USE_PUBLIC_THREADS`. For `Private` it's `USE_PRIVATE_THREADS`.",
													},
												]);
											itr.followUp({
												embeds: [permsEmbed],
												ephemeral: true,
											});
										});
								});
						} else if (btnItr.customId == "ticketing_on_no") {
							let newEmbed = kifo.embed(
								"Command safely canceled."
							);
							btnItr.update({
								embeds: [newEmbed],
								components: [],
								ephemeral: true,
							});
						}
					})
					.catch((err) => {
						let newEmbed = kifo.embed("Command safely canceled.");
						itr.editReply({
							embeds: [newEmbed],
							components: [],
							ephemeral: true,
						});
					});
			});

			//itr.reply({ embeds: [kifo.embed("Ticketing is now ON")] });
		} else {
			subcmd = itr.options.data.find((d) => d.name === "off");
			if (subcmd !== undefined) {
				if (!ticketings.has(itr.channelId))
					return itr.reply({
						embeds: [
							kifo.embed(
								"There is no ticketing system enabled in this channel!"
							),
						],
						ephemeral: true,
					});
				let btnRow = new Discord.MessageActionRow().addComponents([
					new Discord.MessageButton()
						.setCustomId("ticketing_off_yes")
						.setLabel("Yes")
						.setStyle("DANGER"),
					new Discord.MessageButton()
						.setCustomId("ticketing_off_cancel")
						.setLabel("Cancel")
						.setStyle("SECONDARY"),
				]);
				itr.reply({
					embeds: [
						kifo.embed(
							"",
							"Are you sure you want to turn off ticketing system for this channel?"
						),
					],
					components: [btnRow],
				}).then(async () => {
					itreply = await itr.fetchReply();
					itreply
						.awaitMessageComponent({ time: 15000 })
						.then((btnItr) => {
							if (btnItr.member !== itr.member) return;
							if (btnItr.customId === "ticketing_off_yes") {
								con.query(
									"DELETE FROM ticketing WHERE ChannelId = ? AND GuildId = ?",
									[itr.channelId, itr.guildId],
									function (err) {
										if (err) throw err;
									}
								);
								ticketings.delete(itr.channelId);
								itr.editReply({
									embeds: [
										kifo.embed(
											`Ticketing system has been disabled by <@!${itr.member.id}>.`
										),
									],
									components: [],
								});
							} else throw new Error();
						})
						.catch(() => {
							itr.editReply({
								embeds: [
									kifo.embed(
										"Ticketing system is still **operational**."
									),
								],
								components: [],
							});
						});
				});
			} else {
				subcmd = itr.options.data.find((d) => d.name === "list");
				if (subcmd !== undefined) {
					let listEmbed = kifo.embed(
						"",
						"List of channels, where `ticketing` is active:"
					);
					let isSliced = false;
					let fieldArr = [];
					ticketings.forEach((value) => {
						fieldArr.push({
							name: itr.guild.channels.resolve(value.ChannelId)
								.name,
							value: `<#${value.ChannelId}>, archives after ${ms(
								value.DefaultArchive,
								{ long: true }
							)}, ticket visibility: ${
								value.ArePublic ? "public" : "private"
							}, slowmode: ${
								value.DefaultSlowmode == 0
									? "none"
									: ms(value.DefaultSlowmode, { long: true })
							}`,
						});
					});
					if (fieldArr.length > 25) {
						fieldArr = fieldArr.slice(0, 20);
						isSliced = true;
					}
					listEmbed.addFields(fieldArr);
					itr.reply({
						embeds: [listEmbed],
						ephemeral: true,
					});
				}
			}
		}
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
