const limit = 1000;
const kifo = require("kifo");
const main = require(`../../index.js`)
module.exports = {
	name: "list",
	description: `Lists all users in the server, or users having certain role.\nTo list more than ${limit} users you need \`MANAGE_GUILD\` perms.\nIf the bot doesn't see some channels, lists ~~may~~ will be incorrect.`,
	usage: [
		"`list` - lists all users in the server",
		"`list <user>` - lists roles of specified user.",
		"`list <role> <optional_role2> <optional_role_n>` - lists users that have all specified roles.",
		"`list <message_id>` - pastes raw message content *(with formatting, works with embeds and all types of messages)*.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES", "MANAGE_GUILD"],
	async execute(message, args, Discord, prefix) {
		//This is for timestamps
		const ms = require(`ms`);
		const fs = require("fs");

		//for debugging, uncomment to resolve paths
		//const path = require("path");

		function place(number) {
			if (number % 10 == 1 && number % 100 != 11) return `st`;
			if (number % 10 == 2 && number % 100 != 12) return "nd";
			if (number % 10 == 3 && number % 100 != 13) return "rd";
			else return "th";
		}

		//PRECHECKS
		if (message.guild == null)
			return message.reply(
				kifo.embed("you can only run this command on the server.")
			);
		if (
			!message.guild.me.permissionsIn(message.channel).has("ATTACH_FILES")
		)
			return message.reply(
				kifo.embed(
					"I do not have `ATTACH_FILES` permissions in this channel."
				)
			);
		message.channel.startTyping().catch(() => {});
		const newEmbed = new Discord.MessageEmbed();
		let time = new Date(Date.now());

		//if you provide multiple role IDs you get a list of members with these roles
		if (args[1] != undefined) {
			let roleIDs = [];
			i = 0;
			while (args[i] != undefined) {
				if (
					message.guild.roles.cache.find(
						(role) => role.id == args[i]
					) == undefined
				)
					return message.reply(
						kifo.embed(`${args[i]} is not a valid role ID!`)
					);
				roleIDs.push(args[i]);
				i++;
			}

			let memberList = await message.guild.members.cache.filter(
				(member) => member.roles.cache.has(roleIDs[0])
			);
			for (i = 1; i < roleIDs.length; i++) {
				memberList = await memberList.filter((member) =>
					member.roles.cache.has(roleIDs[i])
				);
			}

			var fileContent = `User ID\tPosition\tUser name\tNickname\n`;

			var Count = 0;

			await memberList.each(() => Count++);
			if (
				Count > limit &&
				!message.member.permissions.has("MANAGE_GUILD")
			) {
				message.channel.stopTyping(true);
				return message.reply(
					kifo.embed(
						`The output has ${Count} records, you need \`MANAGE_GUILD\` to create a file this large.`
					)
				);
			}

			await memberList
				// .sorted((memberA, memberB) => {
				// 	return (
				// 		memberB.roles.highest.rawPosition -
				// 		memberA.roles.highest.rawPosition
				// 	);
				// })
				.each((member) => {
					fileContent += `${member.id}\t${
						member.roles.highest.rawPosition
					}\t${member.user.username}\t${member.nickname ?? ""}\n`;
				});

			fs.writeFileSync(
				`./${args[0]}ETCmembers.txt`,
				fileContent,
				() => {}
			);

			var roleList = "";
			for (i = 0; i < roleIDs.length; i++) {
				roleList += `${roleIDs[i]} - ${
					message.guild.roles.cache.find(
						(role) => role.id == roleIDs[i]
					).name
				}\n`;
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
						name: `Role filter:`,
						value: `${roleList}`,
					},
					//{name: "Also:", value: `You can check your own stats with "stats me", or someone else's stats by ${this.usage}`},
					{
						name: "More",
						value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
					}
				)
				.attachFiles([
					{
						attachment: `./${args[0]}ETCmembers.txt`,
						name: `${args[0]}ETCmembers.txt`,
					},
				]);
		}
		let guildcount = 0;

		message.client.guilds.cache.each(() => {
			guildcount++;
		});
		let serverrolecount = 0;
		await message.guild.roles.cache.each(() => serverrolecount++);
		let entity;

		//not multiple roles, plain old stats
		if (args[1] == undefined) {
			//SERVER STATS
			if (args[0] == undefined) {
				let owner = message.guild.owner;
				let botcount = 0;
				let onlinecount = 0;
				let boostcount = 0;

				let channelcount = 0;
				let channelvoicecount = 0;
				let channeltextcount = 0;
				let channelcategorycount = 0;
				let channelnewscount = 0;

				var fileContent = `User ID\tPosition\tUser name\tNickname\n`;
				var Count = 0;

				await message.guild.members.cache.each(() => Count++);
				if (
					Count > limit &&
					!message.member.permissions.has("MANAGE_GUILD")
				) {
					message.channel.stopTyping(true);
					return message.reply(
						kifo.embed(
							`The output has ${Count} records, you need \`MANAGE_GUILD\` to create a file this large.`
						)
					);
				}

				await message.guild.members.cache
					// .sorted((memberA, memberB) => {
					// 	return (
					// 		memberB.roles.highest.rawPosition -
					// 		memberA.roles.highest.rawPosition
					// 	);
					// })
					.each((member) => {
						if (member.user.bot) botcount++;
						if (member.premiumSinceTimestamp != undefined)
							boostcount++;
						fileContent += `${member.id}\t${
							member.roles.highest.rawPosition
						}\t${member.user.username}\t${member.nickname ?? ""}\n`;
					});
				await message.guild.members.cache
					.filter(
						(member) =>
							member.presence.status != "offline" &&
							!member.user.bot
					)
					.each(() => onlinecount++);

				//const ChannelCollection = new Discord.Collection();
				await message.guild.channels.cache.each((channel) => {
					channelcount++;
					// if (ChannelCollection.has(channel.type))
					// {
					// 	ChannelCollection.set(channel.type, ChannelCollection.get(channel.type) + 1)
					// }
					// else
					// {
					// 	ChannelCollection.set(channel.type, 1);
					// }
				});
				// ChannelCollection.each((value, key) => {
				// 	console.log(`${key}: ${value}`)
				// })
				await message.guild.channels.cache
					.filter((channel) => channel.type == "voice")
					.each(() => channelvoicecount++);
				await message.guild.channels.cache
					.filter((channel) => channel.type == "text")
					.each(() => channeltextcount++);
				await message.guild.channels.cache
					.filter((channel) => channel.type == "category")
					.each(() => channelcategorycount++);
				await message.guild.channels.cache
					.filter((channel) => channel.type == "news")
					.each(() => channelnewscount++);

				fs.writeFileSync(
					`./${message.guild.id} members.txt`,
					fileContent,
					() => {}
				);
				//console.log(`${path.resolve(`${message.guild.id}members.txt`)}`);

				let servertime =
					time.getTime() - message.guild.createdAt.getTime();
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
							value: `<:boost:823658698412392449> Tier ${message.guild.premiumTier}, thanks to ${message.guild.premiumSubscriptionCount} boosts.`, //${boostcount} members boosted throughout server's existence.
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
					)
					.attachFiles([
						{
							attachment: `./${message.guild.id} members.txt`,
							name: `${message.guild.name} members.txt`,
						},
					]);
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
						.reply(
							kifo.embed(
								"Unknown entity! Command supports `server`, `user`, `channel` and `message`.\n**Note:** Messages are a bit glitchy, so if you're trying to get `message` by its ID, try this command **twice**."
							)
						)
						.catch(() => {});
				}

				if (whatami == undefined) {
					main.log("SOMETHING BROKE IN LIST COMMAND");
					return message
						.reply(
							kifo.embed(
								"Uknown error has occured when trying to execute the command. Please use `error` command to notify bot author.",
								"Error!"
							)
						)
						.catch(() => {});
				}

				const contents = fs.readFileSync(`././commandList.json`);
				var jsonCmdList = JSON.parse(contents);

				const ppcmd = require(`${jsonCmdList.pp.relativepath}`);
				const howgaycmd = require(`${jsonCmdList.howgay.relativepath}`);
				const iqcmd = require(`${jsonCmdList.iq.relativepath}`);

				//WHAT ARE YOU CHECK ? - determines if you wanna check stats of user, bot, role, channel or message
				if (whatami == "user" && entity.user.bot) whatami = "bot";
				//USER STATS
				if (whatami == "user") {
					let usertime =
						time.getTime() - entity.user.createdAt.getTime();
					let membertime = time.getTime() - entity.joinedAt.getTime();
					let rolecount = 0;
					let fileContent = `Role ID\tPosition\tRole name\n`;
					let statusicon;
					if (
						entity.presence.status == "online" ||
						entity.presence.status == "idle"
					)
						statusicon = "<:online:823658022974521414>";
					else statusicon = "<:offline:823658022957613076>";
					await entity.roles.cache
						// .sorted((roleA, roleB) => {
						// 	return roleB.rawPosition - roleA.rawPosition;
						// })
						.each((role) => {
							fileContent += `${role.id}\t${role.rawPosition}\t${role.name}\n`;
							rolecount++;
						});

					const ppfield = await ppcmd.execute(
						message,
						args,
						Discord,
						true,
						entity.id
					);
					const howgayfield = await howgaycmd.execute(
						message,
						args,
						Discord,
						true
					);
					const iqfield = await iqcmd.execute(
						message,
						args,
						Discord,
						true
					);

					fs.writeFileSync(
						`./${entity.id} roles.txt`,
						fileContent,
						() => {}
					);

					newEmbed
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
							message.guild.me?.user?.avatarURL({
								format: "png",
								dynamic: true,
								size: 64,
							}),
							"https://kifopl.github.io/kifo-clanker/"
						)
						.setFooter(
							`Account created at: ${entity.user.createdAt.toUTCString()}\nAccount joined server at: ${entity.joinedAt.toUTCString()}, ${ms(
								entity.joinedAt.getTime() -
									entity.guild.createdAt.getTime(),
								{ long: true }
							)} after server creation.\nIt is ${ms(usertime, {
								long: true,
							})} old.\nIt joined server ${ms(membertime, {
								long: true,
							})} ago (it joined ${ms(
								entity.joinedAt.getTime() -
									entity.user.createdAt.getTime(),
								{ long: true }
							)} after account creation).\n${
								entity.joinedAt.getTime() -
									entity.user.createdAt.getTime() <
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
												time -
													entity.premiumSince.getTime(),
												{ long: true }
										  )}!`
										: `Not boosting... ***yet***.`
								}`,
							},
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
										  }${place(
												-entity.roles?.highest.comparePositionTo(
													message.guild.roles.highest
												) + 1
										  )} out of ${serverrolecount} server roles), ${
												entity.roles?.hoist?.name ==
												undefined
													? `not hoisted`
													: `\nhoisted as <:hoist:823907804141322311> ${entity.roles?.hoist?.name}`
										  }.`
										: `This account has no roles yet.`
								}`,
							},
							{
								name: `Status`,
								value: `${statusicon} User is currently **${entity.presence.status}**.`,
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
						)
						.attachFiles([
							{
								attachment: `./${entity.id} roles.txt`,
								name: `${entity.id} roles.txt`,
							},
						]);
				}
				//BOT STATS
				else if (whatami == "bot") {
					let usertime =
						time.getTime() - entity.user.createdAt.getTime();
					let membertime = time.getTime() - entity.joinedAt.getTime();
					let rolecount = 0;
					let statusicon;
					let fileContent = `Role ID\tRole name\n`;
					if (
						entity.presence.status == "online" ||
						entity.presence.status == "idle"
					)
						statusicon = "<:online:823658022974521414>";
					else statusicon = "<:offline:823658022957613076>";
					await entity.roles.cache
						// .sorted((roleA, roleB) => {
						// 	return roleB.rawPosition - roleA.rawPosition;
						// })
						.each((role) => {
							rolecount++;
							fileContent += `${role.id}\t${role.name}\n`;
						});
					const ppfield = await ppcmd.execute(
						message,
						args,
						Discord,
						true,
						entity.id
					);
					const howgayfield = await howgaycmd.execute(
						message,
						args,
						Discord,
						true
					);
					const iqfield = await iqcmd.execute(
						message,
						args,
						Discord,
						true
					);

					fs.writeFileSync(
						`./${entity.id} roles.txt`,
						fileContent,
						() => {}
					);

					newEmbed
						.setColor("a039a0")
						.setTitle(`${entity.displayName} stats:`)
						.setDescription(
							`BOT <:info:823907804200435713> <@${
								entity.user.id
							}>, ${
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
							message.guild.me?.user?.avatarURL({
								format: "png",
								dynamic: true,
								size: 64,
							}),
							"https://kifopl.github.io/kifo-clanker/"
						)
						.setFooter(
							`Bot created at: ${entity.user.createdAt.toUTCString()}\nBot joined server at: ${entity.joinedAt.toUTCString()}, ${ms(
								entity.joinedAt.getTime() -
									entity.guild.createdAt.getTime(),
								{ long: true }
							)} after server creation.\nIt is ${ms(usertime, {
								long: true,
							})} old.\nIt joined server ${ms(membertime, {
								long: true,
							})} ago (it joined ${ms(
								entity.joinedAt.getTime() -
									entity.user.createdAt.getTime(),
								{ long: true }
							)} after server creation).`
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
										  }${place(
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
						)
						.attachFiles([
							{
								attachment: `./${entity.id} roles.txt`,
								name: `${entity.id} roles.txt`,
							},
						]);
				}
				//ROLE STATS
				else if (whatami == "role") {
					let rolecreationAt =
						time.getTime() - entity.createdAt.getTime();
					let perms = entity.permissions;
					let membercount = 0;
					var fileContent = `User ID\tPosition\tUser name\tNickname\n`;
					var Count = 0;
					await entity.members
						// .sorted((memberA, memberB) => {
						// 	return (
						// 		memberB.roles.highest.rawPosition -
						// 		memberA.roles.highest.rawPosition
						// 	);
						// })
						.each((member) => {
							membercount++;
							fileContent += `${member.id}\t${
								member.roles.highest.rawPosition
							}\t${member.user.username}\t${
								member.nickname ?? ""
							}\n`;
							Count++;
						});
					if (
						Count > 1000 &&
						!message.member.permissions.has("MANAGE_ROLES")
					)
						return message.reply(
							kifo.embed(
								`The output has ${Count} records, you need \`MANAGE_ROLES\` to create a file this large.`
							)
						);
					let strperms = "";
					await perms
						.toArray()
						.forEach(function (item, index, array) {
							strperms += `${item}\n`;
						});

					fs.writeFileSync(
						`./${entity.id} members.txt`,
						fileContent,
						() => {}
					);

					newEmbed
						.setColor("a039a0")
						.setTitle(`${entity.name} stats:`)
						.setDescription(
							`<:hoist:823907804141322311> <@&${entity.id}>, ID ${entity.id}`
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
								{ long: true }
							)} after server creation.`
						)
						.addFields(
							{
								name: `Colour:`,
								value: `${entity.hexColor}`,
								inline: true,
							},
							{
								name: `Position:`,
								value: `${
									-entity.comparePositionTo(
										message.guild.roles.highest
									) + 1
								}${place(
									-entity.comparePositionTo(
										message.guild.roles.highest
									) + 1
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
						)
						.attachFiles([
							{
								attachment: `./${entity.id} members.txt`,
								name: `${message.id} members.txt`,
							},
						]);
				}
				//CHANNEL STATS --- NOT YET IMPLEMENTED
				else if (whatami == "channel") {
					message.channel.stopTyping(true);
					return message.reply(
						kifo.embed("channel stats will be implemented one day.")
					);

					//TODO FINISH THIS
					type = entity.type;
					emote = "";
					if (type == "text")
						emote = `<:textchannel:823658022849085512>`;
					else if (type == "category")
						emote = `<:categoryNEW:842672130420506625>`;
					else if (type == "voice")
						emote = `<:voice:823658022684721164>`;
					else if (type == "news")
						emote = `<:announcement:842672130587754506>`;
					else
						return message.reply(
							kifo.embed(
								"unsupported channel type! Reach out to KifoPL#3358 to notify him of the error."
							)
						);

					let channelage =
						time.getTime() - entity.createdAt.getTime();

					newEmbed
						.setColor("a039a0")
						.setTitle(`${entity.name} stats:`)
						.setDescription(
							`${emote} ${
								type == "text" || type == "news"
									? entity.topic
									: ""
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
										  }${place(
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
						activity = `Type: ${entity.activity.type}, party ID: ${entity.activity.partyID}`;
					let attachments = [];
					await entity.attachments.each((am) => {
						attachments.push(am);
					});
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
						`./${entity.id} message.txt`,
						fileContent,
						() => {}
					);
					// return message
					// 	.reply(kifo.embed("DETECTED A MESSAGE AYYY"))
					// 	.catch(() => {});

					newEmbed
						.setColor("a039a0")
						.setTitle(`Message stats (click for original message):`)
						.setURL(entity.url)
						.setDescription(
							`Message sent by <@!${entity.author.id}>.`
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
								value: `${entity.content.length}`,
								inline: true,
							},
							{
								name: `Top Reaction:`,
								value: reaction,
								inline: true,
							},
							{
								name: `Type:`,
								value: entity.type,
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
												.map(
													(x) =>
														`[${x.name}](${x.url})`
												)
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
								value: entity.pinned,
								inline: true,
							},
							{
								name: `Is system message (sent by Discord)?`,
								value: entity.system,
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
						)
						.attachFiles([
							{
								attachment: `./${entity.id} message.txt`,
								name: `${entity.id} message.txt`,
							},
						]);
				}
			}
		}
		await message.channel.send(newEmbed).catch((err) => {
			console.error(err);
		});
		message.channel.stopTyping(true);
		try {
			fs.unlink(`./${message.guild.id} members.txt`, () => {}).catch(
				() => {}
			);
		} catch (err) {}
		try {
			fs.unlink(`./${entity.id} members.txt`, () => {}).catch(() => {});
		} catch (err) {}
		try {
			fs.unlink(`./${entity.id} roles.txt`, () => {}).catch(() => {});
		} catch (err) {}
		try {
			fs.unlink(`./${args[0]}ETCmembers.txt`, () => {}).catch(() => {});
		} catch (err) {}
		try {
			fs.unlink(`./${entity.id} message.txt`, () => {}).catch(() => {});
		} catch (err) {}
	},
};

async function whatamifunc(message, args, callback) {
	let entity = undefined;
	let whatami = "not found";

	if (args[0].toUpperCase() == "ME") {
		entity = message.member;
		whatami = "user";
		callback({ entity: entity, whatami: whatami });
		return;
	} else {
		if (!isNaN(args[0])) {
			if (!message.guild.members.resolve(args[0])) {
				if (!message.guild.roles.resolve(args[0])) {
					if (!message.guild.channels.resolve(args[0])) {
						await message.guild.channels.cache
							.filter(
								(ch) => ch.type === "news" || ch.type === "text"
							)
							.each(async (ch) => {
								await ch.messages
									.fetch(args[0])
									.then((msg) => {
										//console.log(msg);
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
							// return message.reply(
							// 	kifo.embed(
							// 		"this ID is neither a role nor a channel, nor a user, nor a message. Please provide valid ID."
							// 	)
							// );
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
				entity = message.guild.members.cache.find(
					(member) => member.id == args[0]
				);
				callback({ entity: entity, whatami: whatami });
				return;
			}
		} else {
			if (message.mentions.members.firstKey() != undefined) {
				entity = message.mentions.members.first();
				whatami = "user";
				callback({ entity: entity, whatami: whatami });
				return;
			} else if (message.mentions.channels.firstKey() != undefined) {
				entity = message.mentions.channels.firstKey();
				whatami = "channel";
				callback({ entity: entity, whatami: whatami });
				return;
			} else if (message.mentions.roles.firstKey() != undefined) {
				entity = message.mentions.roles.firstKey();
				whatami = "role";
				callback({ entity: entity, whatami: whatami });
				return;
			} else {
				whatami = "not found";
				callback({ entity: entity, whatami: whatami });
				return;
				// return message.reply(
				// 	kifo.embed(
				// 		"your message must contain a mention of user, channel, or an ID of user, channel, or role in order to work (remember not to ping role!)."
				// 	)
				// );
			}
		}
	}
}