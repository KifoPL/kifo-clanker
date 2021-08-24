const kifo = require("kifo");
const Discord = require("discord.js");
const { Permissions } = require("discord.js");
const ms = require("ms");
const timer = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = {
	name: "autothreading",
	description: "Set up an auto threading system in a channel.",
	category: "MANAGEMENT",
	options: [
		{
			name: "on",
			type: "SUB_COMMAND",
			description: "Turn on auto-threading system.",
			options: [
				{
					name: "title",
					description:
						"Choose the title for every thread (use /autothreading help for more info)",
					type: "STRING",
					required: true,
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
					name: "bots",
					description:
						"True if you want threads to be created on bot messages as well, false otherwise.",
					type: "BOOLEAN",
					required: true,
				},
				{
					name: "slowmode",
					description:
						"What should be the default slow-mode for threads?",
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
			description: "Turn off auto-threading system.",
			type: "SUB_COMMAND",
		},
		{
			name: "list",
			description:
				"List all channels with auto-threading system enabled.",
			type: "SUB_COMMAND",
		},
		{
			name: "help",
			description:
				"Send a link with very detailed information regarding auto-threading system.",
			type: "SUB_COMMAND",
		},
	],
	defaultPermission: true,
	guildonly: true,
	perms: ["USE_APPLICATION_COMMANDS", "MANAGE_CHANNELS", "MANAGE_THREADS"],

	//itr = interaction
	async execute(itr) {
		const { con, autothreadings } = require("../index.js");
		const main = require("../index.js");

		let subcmd = itr.options.data.find((d) => d.name === "help");
		if (subcmd !== undefined) {
			let btnRow = new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setLabel("Auto-threading Guide")
					.setStyle("LINK")
					.setURL(
						"https://kifopl.github.io/kifo-clanker/guides/autothreading"
					)
			);
			itr.reply({
				components: [btnRow],
				embeds: [
					kifo.embed(
						"Click the button to learn more about auto-threading system."
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
			if (autothreadings.has(itr.channelId))
				return itr.reply({
					embeds: [
						kifo.embed(
							"There is already auto-threading system enabled in this channel."
						),
					],
					ephemeral: true,
				});

			let options = subcmd.options;
			let title = options.find((o) => o.name === "title").value;
			let archiving = options.find((o) => o.name === "archiving").value;
			let slowmode = options.find((o) => o.name === "slowmode")?.value;
			let botAuto = options.find((o) => o.name === "bots").value;
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
			}

			let embedReply = kifo
				.embed(
					"Please make sure that the following settings are correct:",
					"Auto-threading settings:"
				)
				.addFields([
					{
						name: "Archiving:",
						value: `After ${ms(ms(archiving), {
							long: true,
						})} of inactivity.`,
						inline: true,
					},
					{
						name: "Thread on bot message:",
						value: botAuto,
						inline: true,
					},
					{
						name: "Slowmode:",
						value: slowmode ?? "none",
						inline: true,
					},
					{
						name: "Thread title:",
						value: title
							.replace(
								"[member]".toLowerCase(),
								(match) => `\`${match}\``
							)
							.replace(
								"[channel]".toLowerCase(),
								(match) => `\`${match}\``
							)
							.replace(
								"[server]".toLowerCase(),
								(match) => `\`${match}\``
							),
					},
				]);

			const replyComponents =
				new Discord.MessageActionRow().addComponents(
					new Discord.MessageButton()
						.setCustomId("autothreading_on_yes")
						.setLabel("Settings are correct")
						.setStyle("PRIMARY"),
					new Discord.MessageButton()
						.setCustomId("autothreading_on_no")
						.setLabel("Cancel Auto-threading")
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
						if (btnItr.customId == "autothreading_on_yes") {
							embedReply
								.setTitle("Auto-threading system is turned on!")
								.setDescription(
									"*This message will be deleted in 30 seconds.*"
								);
							try {
								con.query(
									"INSERT INTO autothreading (GuildId , ChannelId , DefaultArchive , DefaultSlowmode , BotAuto , Title) VALUES (?, ?, ?, ?, ?, ?)",
									[
										itr.guildId,
										itr.channelId,
										archiving,
										slowmode == null ? null : ms(slowmode),
										botAuto,
										title,
									],
									function (err) {
										if (err) throw err;
										itr.editReply({
											embeds: [embedReply],
											components: [],
										}).catch((err) => {
											console.error(err);
										});
										autothreadings.set(itr.channelId, {
											GuildId: itr.guildId,
											ChannelId: itr.channelId,
											DefaultArchive: archiving,
											DefaultSlowmode:
												slowmode == null
													? null
													: ms(slowmode),
											Title: title,
											BotAuto: botAuto,
										});
										timer(30000).then((_) => {
											itr.deleteReply().catch(() => {});
										});
									}
								);
							} catch (err) {
								embedReply.setTitle(
									"Unable to enable auto threading! Please read follow-up for error details."
								);
								main.log(err);
								itr.editReply({
									embeds: [embedReply],
									components: [],
								});
								itr.followUp({
									embeds: [kifo.embed(err)],
									ephemeral: true,
								});
							}
						} else if (btnItr.customId == "autothreading_on_no") {
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
				if (!autothreadings.has(itr.channelId))
					return itr.reply({
						embeds: [
							kifo.embed(
								"There is no auto-threading system enabled in this channel!"
							),
						],
						ephemeral: true,
					});
				let btnRow = new Discord.MessageActionRow().addComponents([
					new Discord.MessageButton()
						.setCustomId("autothreading_off_yes")
						.setLabel("Yes")
						.setStyle("DANGER"),
					new Discord.MessageButton()
						.setCustomId("autothreading_off_cancel")
						.setLabel("Cancel")
						.setStyle("SECONDARY"),
				]);
				itr.reply({
					embeds: [
						kifo.embed(
							"",
							"Are you sure you want to turn off auto-threading system for this channel?"
						),
					],
					components: [btnRow],
				}).then(async () => {
					itreply = await itr.fetchReply();
					itreply
						.awaitMessageComponent({ time: 15000 })
						.then((btnItr) => {
							if (btnItr.member !== itr.member) return;
							if (btnItr.customId === "autothreading_off_yes") {
								try {
									con.query(
										"DELETE FROM autothreading WHERE ChannelId = ? AND GuildId = ?",
										[itr.channelId, itr.guildId],
										function (err) {
											if (err) throw err;
											autothreadings.delete(
												itr.channelId
											);
											itr.editReply({
												embeds: [
													kifo.embed(
														`Auto-threading system has been disabled by <@!${itr.member.id}>.`
													),
												],
												components: [],
											});
										}
									);
								} catch (error) {
									throw error;
								}
							} else throw new Error();
						})
						.catch(() => {
							itr.editReply({
								embeds: [
									kifo.embed(
										"Auto-threading system is still **operational**."
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
						"List of channels, where `auto-threading` is active:"
					);
					let isSliced = false;
					let fieldArr = [];
					autothreadings.forEach((value) => {
						if (value.GuildId == itr.guildId) {
							fieldArr.push({
								name: itr.guild.channels.resolve(
									value.ChannelId
								).name,
								value: `<#${
									value.ChannelId
								}>, archives after ${ms(value.DefaultArchive, {
									long: true,
								})}, ticket visibility: ${
									value.ArePublic ? "public" : "private"
								}, slowmode: ${
									value.DefaultSlowmode == null
										? "none"
										: ms(value.DefaultSlowmode, {
												long: true,
										  })
								}\n__Message:__ ${value.Title.replace(
									"[member]".toLowerCase(),
									(match) => `\`${match}\``
								)
									.replace(
										"[channel]".toLowerCase(),
										(match) => `\`${match}\``
									)
									.replace(
										"[server]".toLowerCase(),
										(match) => `\`${match}\``
									)}`,
							});
						}
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
