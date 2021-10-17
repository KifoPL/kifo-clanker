const limit = 1000;
const kifo = require("kifo");
const main = require(`../../index.js`);
const Discord = require("discord.js");
const api = require("axios");
const ms = require(`ms`);
const fs = require("fs");
module.exports = {
	name: "list",
	description: `Lists all users in the server, or users having a certain role.\nTo list more than ${limit} users you need \`MANAGE_GUILD\` perms.\nIf the bot doesn't see some channels, lists ~~may~~ will be incorrect.`,
	usage: [
		"`list` - lists all users on the server",
		"`list <user>` - lists roles of specified user.",
		"`list <role> <optional_role2> <optional_role_n>` - lists users that have all specified roles.",
		'~~`list <channel/"here"> <role> <optional_role2> <optional_role_n>` - lists users with specified roles in specified channel.~~ NOT IMPLEMENTED YET.',
		//"`list <message_id>` - pastes raw message content *(with formatting, works with embeds and all types of messages)*.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES", "MANAGE_GUILD"],
	execute: execute,
	stats: stats,
	userstats: userstats,
	botstats: botstats,
};

async function execute(message, args, prefix) {
	stats(message, args, prefix, true);
}

async function whatamifunc(message, args, callback) {
	let entity = undefined;
	let whatami = "not found";

	if (args[0].toUpperCase() == "ME") {
		entity = message.member;
		entity = await message.guild.members.fetch({
			user: [entity.id],
			withPresences: true,
		});
		entity = entity.first();
		whatami = "user";
		callback({ entity: entity, whatami: whatami });
		return;
	} else {
		if (!isNaN(args[0])) {
			if (!message.guild.members.resolve(args[0])) {
				if (!message.guild.roles.resolve(args[0])) {
					if (!message.guild.channels.resolve(args[0])) {
						await message.guild.channels.cache
							.filter((ch) => ch.isText())
							.each(async (ch) => {
								await ch.messages
									.fetch(args[0])
									.then((msg) => {
										entity = msg;
										whatami = "message";
										callback({
											entity: entity,
											whatami: whatami,
										});
										return;
									})
									.catch(() => {});
							});
						if (entity != undefined) {
							whatami = "message";
						} else {
							whatami = "not found";
							callback({ entity: entity, whatami: whatami });
							return;
						}
					} else {
						whatami = "channel";
						entity = message.guild.channels.resolve(args[0]);
						callback({ entity: entity, whatami: whatami });
						return;
					}
				} else {
					whatami = "role";
					entity = message.guild.roles.resolve(args[0]);
					callback({ entity: entity, whatami: whatami });
					return;
				}
			} else {
				whatami = "user";
				entity = await message.guild.members.fetch({
					user: [args[0]],
					withPresences: true,
				});
				entity = entity.first();
				callback({ entity: entity, whatami: whatami });
				return;
			}
		} else {
			if (message.mentions.members.firstKey() != undefined) {
				entity = await message.mentions.members.first().fetch();
				entity = await message.guild.members.fetch({
					user: [entity.id],
					withPresences: true,
				});
				entity = entity.first();
				whatami = "user";
				callback({ entity: entity, whatami: whatami });
				return;
			} else if (message.mentions.channels.firstKey() != undefined) {
				entity = message.mentions.channels.first();
				whatami = "channel";
				callback({ entity: entity, whatami: whatami });
				return;
			} else if (message.mentions.roles.firstKey() != undefined) {
				entity = message.mentions.roles.first();
				whatami = "role";
				callback({ entity: entity, whatami: whatami });
				return;
			} else {
				whatami = "not found";
				callback({ entity: entity, whatami: whatami });
				return;
			}
		}
	}
}

async function stats(message, args, prefix, isList = true) {
	//If you're reading this, good luck understanding wtf is happening here :)

	//for debugging, uncomment to resolve paths
	//const path = require("path");

	//PRECHECKS
	if (message.guild == null)
		return message.reply({
			embeds: [
				kifo.embed("you can only run this command on the server."),
			],
		});
	if (
		isList &&
		!message.guild.me
			.permissionsIn(message.channel)
			.has(Discord.Permissions.FLAGS.ATTACH_FILES)
	)
		return message.reply({
			embeds: [
				kifo.embed(
					"I do not have `ATTACH_FILES` permissions in this channel."
				),
			],
		});
	message.channel.sendTyping().catch(() => {});
	let newEmbed = new Discord.MessageEmbed();
	let time = new Date(Date.now());

	//if you provide multiple role Ids you get a list of members with these roles
	if (args[1] != undefined) {
		//if you want to get list of members witin specific channel.
		if (
			args[0].toLowerCase() == "here" ||
			message.guild.channels.resolve(kifo.mentionTrim(args[0]))
		) {
			if (!isList)
				return message
					.reply({
						embeds: [
							kifo.embed(
								"Too many arguments! If you want to make role filter, use `list`."
							),
						],
					})
					.catch(() => {});
			let thisChannel = null;
			if (args[0].toLowerCase() == "here") thisChannel = message.channel;
			else if (
				message.guild.channels.resolve(kifo.mentionTrim(args[0])) !=
				undefined
			) {
				thisChannel = message.guild.channels.resolve(
					kifo.mentionTrim(args[0])
				);
			}
			if (thisChannel == null)
				return message.reply({
					embeds: [kifo.embed("Invalid channel!")],
				});
			let roleIds = [];
			i = 0;
			args.shift();
			while (args[i] != undefined) {
				if (
					message.guild.roles.resolve(kifo.mentionTrim(args[i])) !=
					undefined
				) {
					roleIds.push(kifo.mentionTrim(args[i]));
				} else
					return message.reply({
						embeds: [kifo.embed(`${args[i]} is not a valid role!`)],
					});
				i++;
			}
			let memberList = await message.guild.members.cache.filter(
				(member) => member.roles.cache.has(roleIds[0])
			);
			for (i = 1; i < roleIds.length; i++) {
				memberList = await memberList.filter((member) =>
					member.roles.cache.has(roleIds[i])
				);
			}

			memberList = await memberList.filter((member) =>
				member
					.permissionsIn(thisChannel)
					.has(Discord.Permissions.FLAGS.VIEW_CHANNEL)
			);

			var fileContent = `User Id\tPosition\tUser name\tNickname\n`;

			var Count = 0;

			await memberList.each(() => Count++);
			if (
				Count > limit &&
				!message.member.permissions.has(
					Discord.Permissions.FLAGS.MANAGE_GUILD
				) &&
				isList
			) {
				return message.reply({
					embeds: [
						kifo.embed(
							`The output has ${Count} records, you need \`MANAGE_GUILD\` to create a file this large.`
						),
					],
				});
			}

			await memberList.each((member) => {
				fileContent += `${member.id}\t${
					member.roles.highest.rawPosition
				}\t${member.user.username}\t${member.nickname ?? ""}\n`;
			});

			fs.writeFileSync(
				`./${time.toISOString().replace(/:/g, () => "_")}_list.txt`,
				fileContent,
				() => {}
			);

			var roleList = "";
			for (i = 0; i < roleIds.length; i++) {
				roleList += `${roleIds[i]} - <@!${roleIds[i]}>\n`;
			}

			newEmbed
				.setColor("a039a0")
				.setTitle(`Multiple roles in ${thisChannel.name} list:`)
				.setDescription(
					"You will find the list of members with all specified roles in the ``.txt`` attachment"
				)
				.setAuthor(
					"Kifo Clanker™, by KifoPL#3358",
					message.guild.me?.user?.avatarURL({
						format: "png",
						dynamic: true,
						size: 64,
					}),
					"https://kifopl.github.io/kifo-clanker/"
				)
				.setFooter(`State of members as of ${time.toUTCString()}.`)
				.addFields(
					{
						name: `${thisChannel.name}`,
						value: `Showing people who are in <#${thisChannel.id}>.`,
					},
					{
						name: `Role filter (${i} role${i > 1 ? "s" : ""}):`,
						value: `${roleList}`,
					},
					{
						name: `Result:`,
						value: `Found ${Count} members with given criteria.`,
					},
					//{name: "Also:", value: `You can check your own stats with "stats me", or someone else's stats by ${this.usage}`},
					{
						name: "More",
						value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
					}
				);
		} else if (isList) {
			let roleIds = [];
			i = 0;
			while (args[i] != undefined) {
				if (
					message.guild.roles.resolve(kifo.mentionTrim(args[i])) !=
					undefined
				) {
					roleIds.push(kifo.mentionTrim(args[i]));
					args[i] = kifo.mentionTrim(args[i]);
				} else
					return message.reply({
						embeds: [kifo.embed(`${args[i]} is not a valid role!`)],
					});
				i++;
			}

			let memberList = await message.guild.members.cache.filter(
				(member) => member.roles.cache.has(roleIds[0])
			);
			for (i = 1; i < roleIds.length; i++) {
				memberList = await memberList.filter((member) =>
					member.roles.cache.has(roleIds[i])
				);
			}

			var fileContent = `User Id\tPosition\tUser name\tNickname\n`;

			var Count = 0;

			await memberList.each(() => Count++);
			if (
				Count > limit &&
				!message.member.permissions.has(
					Discord.Permissions.FLAGS.MANAGE_GUILD
				) &&
				isList
			) {
				return message.reply({
					embeds: [
						kifo.embed(
							`The output has ${Count} records, you need \`MANAGE_GUILD\` to create a file this large.`
						),
					],
				});
			}

			await memberList.each((member) => {
				fileContent += `${member.id}\t${
					member.roles.highest.rawPosition
				}\t${member.user.username}\t${member.nickname ?? ""}\n`;
			});

			fs.writeFileSync(
				`./${time.toISOString().replace(/:/g, () => "_")}_list.txt`,
				fileContent,
				() => {}
			);

			var roleList = "";
			for (i = 0; i < roleIds.length; i++) {
				roleList += `${roleIds[i]} - <@!${roleIds[i]}>\n`;
			}

			newEmbed
				.setColor("a039a0")
				.setTitle(`Multiple roles list:`)
				.setDescription(
					"You will find the list of members with all specified roles in the ``.txt`` attachment"
				)
				.setAuthor(
					"Kifo Clanker™, by KifoPL#3358",
					message.guild.me?.user?.avatarURL({
						format: "png",
						dynamic: true,
						size: 64,
					}),
					"https://kifopl.github.io/kifo-clanker/"
				)
				.setFooter(`State of members as of ${time.toUTCString()}.`)
				.addFields(
					{
						name: `Role filter (${i} role${i > 1 ? "s" : ""}):`,
						value: `${roleList}`,
					},
					{
						name: `Result:`,
						value: `Found ${Count} members with given criteria.`,
					},
					{
						name: "More",
						value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
					}
				);
		} else {
			return message
				.reply({
					embeds: [
						kifo.embed(
							"Too many arguments! If you want to make role filter, use `list`."
						),
					],
				})
				.catch(() => {});
		}
		args[1] =
			"This is one of the funniest workaround to my shit boolean logic. Lol.";
	}

	let guildcount = 0;

	message.client.guilds.cache.each(() => {
		guildcount++;
	});

	let entity;

	//not multiple roles, plain old stats
	if (args[1] == undefined) {
		//SERVER STATS
		if (args[0] == undefined) {
			let owner = await message.guild.fetchOwner();
			let botcount = 0;
			let onlinecount = 0;
			let boostcount = 0;
			let serverrolecount = 0;
			await message.guild.roles.cache.each(() => serverrolecount++);

			let channelcount = 0;
			let channelvoicecount = 0;
			let channelstagecount = 0;
			let channeltextcount = 0;
			let channelcategorycount = 0;
			let channelnewscount = 0;

			var fileContent = `User Id\tPosition\tUser name\tNickname\n`;
			var Count = 0;

			await message.guild.members.cache.each(() => Count++);
			if (
				Count > limit &&
				!message.member.permissions.has(
					Discord.Permissions.FLAGS.MANAGE_GUILD
				) &&
				isList
			) {
				return message.reply({
					embeds: [
						kifo.embed(
							`The output has ${Count} records, you need \`MANAGE_GUILD\` to create a file this large.`
						),
					],
				});
			}

			if (isList) {
				await message.guild.members.cache.each((member) => {
					fileContent += `${member.id}\t${
						member.roles.highest.rawPosition
					}\t${member.user.username}\t${member.nickname ?? ""}\n`;
				});
			}
			await message.guild.members.cache.each((member) => {
				if (member.user.bot) botcount++;
				if (member.premiumSinceTimestamp != undefined) boostcount++;
			});

			message.guild.presences.cache
				.filter((pr) => !pr.user.bot && pr.status !== "offline")
				.each(() => onlinecount++);

			await message.guild.channels.cache.each(() => {
				channelcount++;
			});
			await message.guild.channels.cache
				.filter((channel) => channel.type == "GUILD_VOICE")
				.each(() => channelvoicecount++);
			await message.guild.channels.cache
				.filter((channel) => channel.type == "GUILD_STAGE_VOICE")
				.each(() => channelstagecount++);
			await message.guild.channels.cache
				.filter((channel) => channel.type == "GUILD_TEXT")
				.each(() => channeltextcount++);
			await message.guild.channels.cache
				.filter((channel) => channel.type == "GUILD_CATEGORY")
				.each(() => channelcategorycount++);
			await message.guild.channels.cache
				.filter((channel) => channel.type == "GUILD_NEWS")
				.each(() => channelnewscount++);

			if (isList) {
				fs.writeFileSync(
					`./${time.toISOString().replace(/:/g, () => "_")}_list.txt`,
					fileContent,
					() => {}
				);
			}

			let servertime = time.getTime() - message.guild.createdAt.getTime();
			newEmbed
				.setColor("a039a0")
				.setTitle(
					message.guild.name +
						` stats: ||also try "${prefix}stats me"||`
				)
				.setThumbnail(
					message.guild.iconURL({
						format: "png",
						dynamic: true,
						size: 64,
					})
				)
				.setDescription(
					message.guild.description != null
						? message.guild.description
						: "No server description set."
				)
				.setImage(
					message.guild.bannerURL({
						format: "png",
						dynamic: true,
						size: 512,
					})
				)
				.setAuthor(
					`Kifo Clanker™, helping ${guildcount} servers!`,
					message.guild.me?.user?.avatarURL({
						format: "png",
						dynamic: true,
						size: 64,
					}),
					"https://kifopl.github.io/kifo-clanker/"
				)
				.setFooter(
					`Server created at ${message.guild.createdAt.toUTCString()}, it is ${ms(
						servertime,
						{ long: true }
					)} old (current time: ${time.toUTCString()}).`
				)
				.addFields(
					{
						name: "Member Count:",
						value: `Users: <:offline:823658022957613076> ${
							message.guild.memberCount - botcount
						} (<:online:823658022974521414> ${onlinecount} online), 🤖 Bots: ${botcount}, Total: ${
							message.guild.memberCount
						}.`,
					},
					{
						name: `Boosts status:`,
						value: `<:boost:823658698412392449> ${message.guild.premiumTier}, thanks to ${message.guild.premiumSubscriptionCount} boosts.`, //${boostcount} members boosted throughout server's existence.
					},
					{
						name: `Region`,
						value: `${message.guild.region}`,
						inline: true,
					},
					{
						name: `Roles`,
						value: `<:role:823658022948700240> ${serverrolecount}`,
						inline: true,
					},
					{
						name: `<:owner:823658022785908737> Owner`,
						value: `${
							owner.nickname == undefined
								? "No nickname set,"
								: `${owner.nickname}, AKA`
						} ${owner.user.tag}.`,
						inline: true,
					},
					{
						name: `Channels`,
						value: `<:voice:823658022684721164> ${channelvoicecount} voice channel${
							channelvoicecount != 1 ? "s" : ""
						}, <:stage:842672130541617152> ${channelstagecount} stage channels${
							channelstagecount != 1 ? "s" : ""
						}, <:textchannel:823658022849085512> ${channeltextcount} text channel${
							channeltextcount != 1 ? "s" : ""
						}, <:categoryNEW:842672130420506625> ${channelcategorycount} categor${
							channelcategorycount != 1 ? "ies" : "y"
						}, <:announcement:842672130587754506> ${channelnewscount} news channel${
							channelnewscount != 1 ? "s" : ""
						}, Total: ${channelcount}.`,
					},
					// {name: `\u200B`, value: `\u200B`},
					{
						name: "More",
						value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
					}
				);
		} else {
			//NOT SERVER STATS (user, bot, role, channel, message)

			let whatami = `assign to either "user | bot | role | channel | message not found"`;

			//my first custom callback function
			await whatamifunc(message, args, function (result) {
				whatami = result.whatami;
				entity = result.entity;
			});

			if (whatami == "not found") {
				return message
					.reply({
						embeds: [
							kifo.embed(
								"Unknown entity! Command supports `server`, `user`, `channel` and `message`.\n**Note:** Messages are a bit glitchy, so if you're trying to get `message` by its Id, try this command **twice**."
							),
						],
					})
					.catch(() => {});
			}

			if (whatami == undefined) {
				main.log("SOMETHING BROKE IN LIST COMMAND");
				return message
					.reply({
						embeds: [
							kifo.embed(
								"Uknown error has occured when trying to execute the command. Please use `error` command to notify bot author.",
								"Error!"
							),
						],
					})
					.catch(() => {});
			}

			if (entity == undefined) {
				main.log("SOMETHING BROKE IN LIST COMMAND");
				return message
					.reply({
						embeds: [
							kifo.embed(
								"Uknown error has occured when trying to execute the command. Please use `error` command to notify bot author.",
								"Error!"
							),
						],
					})
					.catch(() => {});
			}

			//WHAT ARE YOU CHECK ? - determines if you wanna check stats of user, bot, role, channel or message
			if (whatami == "user" && entity.user.bot) whatami = "bot";
			//USER STATS
			if (whatami == "user") {
				newEmbed = await userstats(message, entity, isList, time);
			}
			//BOT STATS
			else if (whatami == "bot") {
				newEmbed = await botstats(message, entity, isList, time);
			}
			//ROLE STATS
			else if (whatami == "role") {
				let serverrolecount = 0;
				await message.guild.roles.cache.each(() => serverrolecount++);
				let rolecreationAt =
					time.getTime() - entity.createdAt.getTime();
				let perms = entity.permissions;
				let membercount = 0;
				var fileContent = `User Id\tPosition\tUser name\tNickname\n`;
				var Count = 0;
				await entity.members.each(() => {
					membercount++;
					Count++;
				});
				if (isList)
					await entity.members.each((member) => {
						fileContent += `${member.id}\t${
							member.roles.highest.rawPosition
						}\t${member.user.username}\t${member.nickname ?? ""}\n`;
					});
				if (
					Count > 1000 &&
					!message.member.permissions.has(
						Discord.Permissions.FLAGS.MANAGE_ROLES
					) &&
					isList
				)
					return message.reply({
						embeds: [
							kifo.embed(
								`The output has ${Count} records, you need \`MANAGE_ROLES\` to create a file this large.`
							),
						],
					});
				let strperms = "";
				await perms.toArray().forEach(function (item, index, array) {
					strperms += `${item}\n`;
				});

				if (isList)
					fs.writeFileSync(
						`./${time
							.toISOString()
							.replace(/:/g, () => "_")}_list.txt`,
						fileContent,
						() => {}
					);

				let colour = await api.get(`http://www.thecolorapi.com/id`, {
					params: { hex: entity.hexColor.slice(1) },
				});

				newEmbed = newEmbed
					.setColor("a039a0")
					.setTitle(`${entity.name} stats:`)
					.setDescription(
						`<:hoist:823907804141322311> <@&${entity.id}>, Id ${entity.id}`
					)
					.setAuthor(
						"Kifo Clanker™, by KifoPL#3358",
						message.guild.me?.user?.avatarURL({
							format: "png",
							dynamic: true,
							size: 64,
						}),
						"https://kifopl.github.io/kifo-clanker/"
					)
					.setFooter(
						`Role created at: ${entity.createdAt.toUTCString()} - ${ms(
							rolecreationAt,
							{ long: true }
						)} ago, ${ms(
							entity.createdAt - message.guild.createdAt,
							{
								long: true,
							}
						)} after server creation.`
					)
					.addFields(
						{
							name: `Colour:`,
							value: `${entity.hexColor}${
								colour.status === 200
									? `\n${colour.data.name.value}`
									: ``
							}`,
							inline: true,
						},
						{
							name: `Position:`,
							value: `${kifo.place(
								entity.guild.roles.highest?.rawPosition -
									entity.rawPosition +
									1
							)} out of ${serverrolecount}`,
							inline: true,
						},
						{
							name: `Members with this role:`,
							value: `${membercount}`,
							inline: true,
						},
						// {
						// 	name: "\u200b",
						// 	value: "\u200b",
						// },
						{
							name: `Is managed by external service?`,
							value: `${entity.managed ? "Yes." : "No."}`,
							inline: true,
						},
						{
							name: `Is hoisted (visible in user list)?`,
							value: `${entity.hoist ? "Yes." : "No."}`,
							inline: true,
						},
						{
							name: `Is mentionable by everyone?`,
							value: `${entity.mentionable ? "Yes." : "No."}`,
							inline: true,
						},
						{
							name: `Permissions:`,
							value: `${
								strperms.length != 0 ? strperms : "none"
							}`,
						},
						//{name: "Also:", value: `You can check your own stats with "stats me", or someone else's stats by ${this.usage}`},
						{
							name: "More",
							value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
						}
					);
			}
			//CHANNEL STATS --- NOT YET IMPLEMENTED
			else if (whatami == "channel") {
				return message.reply({
					embeds: [
						kifo.embed(
							"channel stats will be implemented one day."
						),
					],
				});

				//TODO FINISH THIS
				type = entity.type;
				emote = "";
				if (type == "text") emote = `<:textchannel:823658022849085512>`;
				else if (type == "category")
					emote = `<:categoryNEW:842672130420506625>`;
				else if (type == "voice") emote = `<:voice:823658022684721164>`;
				else if (type == "news")
					emote = `<:announcement:842672130587754506>`;
				else
					return message.reply({
						embeds: [
							kifo.embed(
								"unsupported channel type! Reach out to KifoPL#3358 to notify him of the error."
							),
						],
					});

				let channelage = time.getTime() - entity.createdAt.getTime();

				newEmbed
					.setColor("a039a0")
					.setTitle(`${entity.name} stats:`)
					.setDescription(
						`${emote} ${
							type == "text" || type == "news" ? entity.topic : ""
						}`
					)
					.setAuthor(
						"Kifo Clanker™, by KifoPL#3358",
						message.guild.me?.user?.avatarURL({
							format: "png",
							dynamic: true,
							size: 64,
						}),
						"https://kifopl.github.io/kifo-clanker/"
					)
					.setFooter(
						`Channel created at: ${entity.createdAt.toUTCString()}, ${ms(
							entity.createdAt.getTime() -
								entity.guild.createdAt.getTime(),
							{ long: true }
						)} after server creation.\nIt is ${ms(channelage, {
							long: true,
						})} old.`
					)
					.addFields(
						{
							name: `Roles`,
							value: `<:role:823658022948700240> ${
								rolecount != 1
									? `${
											rolecount - 1
									  } roles, highest role is ${
											entity.roles?.highest?.name
									  } (${
											-entity.roles?.highest.comparePositionTo(
												message.guild.roles.highest
											) + 1
									  }${kifo.place(
											-entity.roles?.highest.comparePositionTo(
												message.guild.roles.highest
											) + 1
									  )} out of ${serverrolecount} server roles), ${
											entity.roles?.hoist?.name ==
											undefined
												? `not hoisted`
												: `\nhoisted as <:hoist:823907804141322311> ${entity.roles?.hoist?.name}`
									  }.`
									: `This bot has no roles yet.`
							}`,
						},
						{
							name: `Status`,
							value: `${statusicon} Bot is currently **${entity.presence.status}**.`,
						},
						{
							name: `Interesting stats:`,
							value: `(They're seriously interesting, though!)`,
						},
						{
							name: `IQ level: ${iqfield.name}`,
							value: iqfield.value,
							inline: true,
						},
						{
							name: `PP: ${ppfield.name}`,
							value: ppfield.value,
							inline: true,
						},
						{
							name: `Gayness level: ${howgayfield.name}`,
							value: howgayfield.value,
							inline: false,
						},
						//{name: "Also:", value: `You can check your own stats with "stats me", or someone else's stats by ${this.usage}`},
						{
							name: "More",
							value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
						}
					);
			}
			//MESSAGE STATS
			else if (whatami == "message") {
				return message.reply({
					embeds: [
						kifo.embed(
							"Because of newest Discord API features, this command is broke. There will be a replacement `/` command soon™."
						),
					],
				});
				//TODO F for message stats
				await entity.fetch().then((msg) => (entity = msg));
				let topReaction = await entity.reactions.cache
					.sort((a, b) => b.count - a.count)
					.first();
				let reaction =
					topReaction?.emoji.identifier == null
						? `no reactions`
						: `${topReaction?.emoji.toString()}`;
				let fileContent = "Message content with formatting:\n\n";
				let activity = entity.activity;
				if (activity != null)
					activity = `Type: ${entity.activity.type}, party Id: ${entity.activity.partyId}`;
				let attachments = [];
				await entity.attachments.each((am) => {
					attachments.push(am);
				});
				if (isList) {
					fileContent += entity.content;
					//if it has embeds
					if (entity.embeds.length > 0) {
						fileContent += "\n\n";
						fileContent += entity.embeds
							.map(
								(eb) =>
									`**Embed message (human-readable):**\n\nDescription:\n${
										eb.description
									}\n\nFields:\n\n${eb.fields
										.map(
											(field) =>
												`${field.name}\n${field.value}\n`
										)
										.join("\n")}\n\nFooter: ${
										eb.footer?.text
									}\n\nColor: ${eb.hexColor}\n\nLength: ${
										eb.length
									}\n\n**JSON (code-readable, programmer-readable)**:\n${JSON.stringify(
										eb.toJSON(),
										null,
										4
									)}`
							)
							.join("\n\n\n");
					}
					fs.writeFileSync(
						`./${time
							.toISOString()
							.replace(/:/g, () => "_")}_list.txt`,
						fileContent,
						() => {}
					);
				}
				newEmbed
					.setColor("a039a0")
					.setTitle(`Message stats (click for original message):`)
					.setURL(entity.url)
					.setDescription(`Message sent by <@!${entity.author.id}>.`)
					.setAuthor(
						"Kifo Clanker™, by KifoPL#3358",
						message.guild.me?.user?.avatarURL({
							format: "png",
							dynamic: true,
							size: 64,
						}),
						"https://kifopl.github.io/kifo-clanker/"
					)
					.setFooter(
						`Message sent at: ${entity.createdAt.toUTCString()}\n ${ms(
							entity.createdAt.getTime() -
								entity.guild.createdAt.getTime(),
							{ long: true }
						)} after server creation.`
					)
					.addFields(
						{
							name: `<:textchannel:823658022849085512> channel:`,
							value: `<#${entity.channel.id}>`,
						},
						{
							name: `Content length:`,
							value: `${entity.content?.length ?? "no content"}`,
							inline: true,
						},
						{
							name: `Top Reaction:`,
							value: reaction,
							inline: true,
						},
						{
							name: `Type:`,
							value: entity.type ?? "unknown",
							inline: true,
						},
						{
							name: `Flags:`,
							value: `${
								entity.flags.toArray.length > 0
									? entity.flags.toArray.join(", ")
									: "no flags."
							}`,
							inline: true,
						},
						{
							name: `Attachments:`,
							value: `${
								attachments.length > 0
									? attachments
											.map((x) => `[${x.name}](${x.url})`)
											.join("\n")
									: "no attachments."
							}`,
							inline: false,
						},
						{
							name: `Embeds`,
							value: `${entity.embeds.length} embeds`,
							inline: true,
						},
						{
							name: `Last edit:`,
							value:
								entity.editedAt?.toUTCString() ??
								"message isn't edited.",
							inline: true,
						},
						{
							name: `Is pinned?`,
							value: entity.pinned ?? "false",
							inline: true,
						},
						{
							name: `Is system message (sent by Discord)?`,
							value: entity.system ?? "false",
							inline: true,
						},
						{
							name: `Activity:`,
							value: `${activity ?? "no activity"}`,
							inline: true,
						},
						//{name: "Also:", value: `You can check your own stats with "stats me", or someone else's stats by ${this.usage}`},
						{
							name: "More",
							value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
						}
					);
			}
		}
	}
	if (isList) {
		await message
			.reply({
				embeds: [newEmbed],
				files: [
					`./${time.toISOString().replace(/:/g, () => "_")}_list.txt`,
				],
			})
			.catch((err) => main.log(err));
		fs.unlink(
			`./${time.toISOString().replace(/:/g, () => "_")}_list.txt`,
			(err) => {
				main.log(err);
			}
		);
	} else
		await message.reply({ embeds: [newEmbed] }).catch((err) => {
			main.log(err);
		});
}

async function userstats(
	itr,
	entity,
	isList = true,
	time = new Date(Date.now())
) {
	const ppcmd = require(`../../slash_commands/pp`);
	const howgaycmd = require(`../../slash_commands/howgay`);
	const iqcmd = require(`../../slash_commands/iq`);

	let presence = undefined;

	presence = itr.guild.presences.cache.find((pr) => pr.userId == entity.id);

	let newEmbed = new Discord.MessageEmbed();

	let usertime = time.getTime() - entity.user.createdAt.getTime();
	let membertime = time.getTime() - entity.joinedAt.getTime();
	let rolecount = 0;
	let serverrolecount = 0;
	await itr.guild.roles.cache.each(() => serverrolecount++);
	let fileContent = `Role Id\tPosition\tRole name\n`;
	let statusicon;
	if (presence?.status == "online" || presence?.status == "idle")
		statusicon = "<:online:823658022974521414>";
	else statusicon = "<:offline:823658022957613076>";
	await entity.roles.cache
		// // .sorted((roleA, roleB) => {
		// // 	return roleB.rawPosition - roleA.rawPosition;
		// // })
		.each(() => {
			rolecount++;
		});
	if (isList) {
		entity.roles.cache.each((role) => {
			fileContent += `${role.id}\t${role.rawPosition}\t${role.name}\n`;
		});
	}

	const ppfield = await ppcmd.calculate(entity.id, entity.guild.id);
	const howgayfield = await howgaycmd.calculate(entity.id, entity.guild.id);
	const iqfield = await iqcmd.calculate(entity.id, entity.guild.id);

	if (isList) {
		fs.writeFileSync(
			`./${time.toISOString().replace(/:/g, () => "_")}_list.txt`,
			fileContent,
			() => {}
		);
	}

	return newEmbed
		.setColor("a039a0")
		.setTitle(`${entity.displayName} stats:`)
		.setDescription(
			`<:info:823907804200435713> <@${entity.user.id}>, ${
				entity.nickname == undefined
					? "No nickname set,"
					: `${entity.nickname}, AKA`
			} ${entity.user.tag}.`
		)
		.setImage(
			entity.user.displayAvatarURL({
				format: "png",
				dynamic: true,
				size: 512,
			})
		)
		.setAuthor(
			"Kifo Clanker™, by KifoPL#3358",
			itr.guild.me?.user?.avatarURL({
				format: "png",
				dynamic: true,
				size: 64,
			}),
			"https://kifopl.github.io/kifo-clanker/"
		)
		.setFooter(
			`Account created at: ${entity.user.createdAt.toUTCString()}\nAccount joined server at: ${entity.joinedAt.toUTCString()}, ${ms(
				entity.joinedAt.getTime() - entity.guild.createdAt.getTime(),
				{ long: true }
			)} after server creation.\nIt is ${ms(usertime, {
				long: true,
			})} old.\nIt joined server ${ms(membertime, {
				long: true,
			})} ago (it joined ${ms(
				entity.joinedAt.getTime() - entity.user.createdAt.getTime(),
				{ long: true }
			)} after account creation).\n${
				entity.joinedAt.getTime() - entity.user.createdAt.getTime() <
				ms("1h")
					? `It *could* be an alt.`
					: `It *probably* isn't alt.`
			}`
		)
		.addFields(
			{
				name: `Boost status:`,
				value: `<:boost:823658698412392449> ${
					entity.premiumSince != undefined
						? `Boosting since ${entity.premiumSince.toUTCString()}, that's ${ms(
								time - entity.premiumSince.getTime(),
								{ long: true }
						  )}!`
						: `Not boosting... ***yet***.`
				}`,
			},
			{
				name: `Roles`,
				value: `<:role:823658022948700240> ${
					rolecount != 1
						? `${rolecount - 1} roles, highest role is ${
								entity.roles?.highest?.name
						  } (${kifo.place(
								entity.guild.roles.highest?.rawPosition -
									entity.roles?.highest?.rawPosition +
									1
						  )} out of ${serverrolecount} server roles), ${
								entity.roles?.hoist?.name == undefined
									? `not hoisted`
									: `\nhoisted as <:hoist:823907804141322311> ${entity.roles?.hoist?.name}`
						  }.`
						: `This account has no roles yet.`
				}`,
			},
			{
				name: `Status`,
				value: `${statusicon} User is currently **${
					presence?.status ?? "offline"
				}**.`,
			},
			{
				name: `IQ level: ${iqfield.name}`,
				value: iqfield.value,
				inline: true,
			},
			{
				name: `PP: ${ppfield.name}`,
				value: ppfield.value,
				inline: true,
			},
			{
				name: `Gayness level: ${howgayfield.name}`,
				value: howgayfield.value,
				inline: false,
			},
			////{name: "Also:", value: `You can check your own stats with "stats me", or someone else's stats by ${this.usage}`},
			{
				name: "More",
				value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
			}
		);
}

async function botstats(
	itr,
	entity,
	isList = true,
	time = new Date(Date.now())
) {
	const ppcmd = require(`../../slash_commands/pp`);
	const howgaycmd = require(`../../slash_commands/howgay`);
	const iqcmd = require(`../../slash_commands/iq`);

	let presence = undefined;

	presence = itr.guild.presences.cache.find((pr) => pr.userId == entity.id);

	let newEmbed = new Discord.MessageEmbed();
	let usertime = time.getTime() - entity.user.createdAt.getTime();
	let membertime = time.getTime() - entity.joinedAt.getTime();
	let rolecount = 0;
	let serverrolecount = 0;
	await itr.guild.roles.cache.each(() => serverrolecount++);
	let statusicon;
	let fileContent = `Role Id\tRole name\n`;
	if (
		entity.presence?.status == "online" ||
		entity.presence?.status == "idle"
	)
		statusicon = "<:online:823658022974521414>";
	else statusicon = "<:offline:823658022957613076>";
	await entity.roles.cache.each(() => {
		rolecount++;
	});
	if (isList) {
		await entity.roles.cache.each((role) => {
			fileContent += `${role.id}\t${role.name}\n`;
		});
	}
	const ppfield = await ppcmd.calculate(entity.id, entity.guild.id);
	const howgayfield = await howgaycmd.calculate(entity.id, entity.guild.id);
	const iqfield = await iqcmd.calculate(entity.id, entity.guild.id);

	if (isList) {
		fs.writeFileSync(
			`./${time.toISOString().replace(/:/g, () => "_")}_list.txt`,
			fileContent,
			() => {}
		);
	}

	return newEmbed
		.setColor("a039a0")
		.setTitle(`${entity.displayName} stats:`)
		.setDescription(
			`BOT <:info:823907804200435713> <@${entity.user.id}>, ${
				entity.nickname == undefined
					? "No nickname set,"
					: `${entity.nickname}, AKA`
			} ${entity.user.tag}.`
		)
		.setImage(
			entity.user.displayAvatarURL({
				format: "png",
				dynamic: true,
				size: 512,
			})
		)
		.setAuthor(
			"Kifo Clanker™, by KifoPL#3358",
			itr.guild.me?.user?.avatarURL({
				format: "png",
				dynamic: true,
				size: 64,
			}),
			"https://kifopl.github.io/kifo-clanker/"
		)
		.setFooter(
			`Bot created at: ${entity.user.createdAt.toUTCString()}\nBot joined server at: ${entity.joinedAt.toUTCString()}, ${ms(
				entity.joinedAt.getTime() - entity.guild.createdAt.getTime(),
				{ long: true }
			)} after server creation.\nIt is ${ms(usertime, {
				long: true,
			})} old.\nIt joined server ${ms(membertime, {
				long: true,
			})} ago (it joined ${ms(
				entity.joinedAt.getTime() - entity.user.createdAt.getTime(),
				{ long: true }
			)} after account creation).`
		)
		.addFields(
			{
				name: `Roles`,
				value: `<:role:823658022948700240> ${
					rolecount != 1
						? `${rolecount - 1} roles, highest role is ${
								entity.roles?.highest?.name
						  } (${kifo.place(
								entity.guild.roles.highest?.rawPosition -
									entity.roles?.highest?.rawPosition +
									1
						  )} out of ${serverrolecount} server roles), ${
								entity.roles?.hoist?.name == undefined
									? `not hoisted`
									: `\nhoisted as <:hoist:823907804141322311> ${entity.roles?.hoist?.name}`
						  }.`
						: `This bot has no roles yet.`
				}`,
			},
			{
				name: `Status`,
				value: `${statusicon} Bot is currently **${
					presence?.status ?? "offline"
				}**.`,
			},
			{
				name: `Interesting stats:`,
				value: `(They're seriously interesting, though!)`,
			},
			{
				name: `IQ level: ${iqfield.name}`,
				value: iqfield.value,
				inline: true,
			},
			{
				name: `PP: ${ppfield.name}`,
				value: ppfield.value,
				inline: true,
			},
			{
				name: `Gayness level: ${howgayfield.name}`,
				value: howgayfield.value,
				inline: false,
			},
			//{name: "Also:", value: `You can check your own stats with "stats me", or someone else's stats by ${this.usage}`},
			{
				name: "More",
				value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
			}
		);
}
