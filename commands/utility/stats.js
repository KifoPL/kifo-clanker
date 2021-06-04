module.exports = {
	name: "stats",
	description: `Displays server stats, or user stats if user provided.`,
	usage: "!kifo stats <opional_user_or_role> <optioanl_role2> <optional_role_n>",
	adminonly: false,
	async execute(message, args, Discord) {
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
				"you can only run this command on the server."
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
					return message.reply(`${args[i]} is not a valid role ID!`);
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
					"https://github.com/KifoPL/kifo-clanker/"
				)
				.setFooter(`State of members as of ${time.toUTCString()}.`)
				.addFields(
					{
						name: `Role filter:`,
						value: `${roleList}`,
					},
					//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
					{
						name: "More",
						value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
					}
				);
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
				//console.log(`${path.resolve(`${message.guild.id}members.txt`)}`);

				let servertime =
					time.getTime() - message.guild.createdAt.getTime();
				newEmbed
					.setColor("a039a0")
					.setTitle(
						message.guild.name +
							` stats: ||also try "!kifo stats me"||`
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
						"https://github.com/KifoPL/kifo-clanker/"
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
					);
			} else {
				//NOT SERVER STATS (user, bot, role, channel)

				let whatami = `assign to either "user | bot | role | channel | not found"`;

				const contents = fs.readFileSync(`././commandList.json`);
				var jsonCmdList = JSON.parse(contents);

				const ppcmd = require(`${jsonCmdList.pp.relativepath}`);
				const howgaycmd = require(`${jsonCmdList.howgay.relativepath}`);
				const iqcmd = require(`${jsonCmdList.iq.relativepath}`);

				//WHAT ARE YOU CHECK ? - determines if you wanna check stats of user, bot, role, or channel
				if (args[0].toUpperCase() == "ME") {
					entity = message.member;
					whatami = "user";
				} else {
					if (!isNaN(args[0])) {
						if (!message.guild.members.resolve(args[0])) {
							if (!message.guild.roles.resolve(args[0])) {
								if (!message.guild.channels.resolve(args[0])) {
									whatami = "not found";
									return message.reply(
										"this ID is neither a role nor a channel, nor a user. Please provide valid ID."
									);
								} else {
									whatami = "channel";
									entity = message.guild.channels.resolve(
										args[0]
									);
								}
							} else {
								whatami = "role";
								entity = message.guild.roles.resolve(args[0]);
							}
						} else {
							whatami = "user";
							entity = message.guild.members.cache.find(
								(member) => member.id == args[0]
							);
						}
					} else {
						if (message.mentions.members.firstKey() != undefined) {
							entity = message.mentions.members.first();
							whatami = "user";
						} else if (
							message.mentions.channels.firstKey() != undefined
						) {
							entity = message.mentions.channels.firstKey();
							whatami = "channel";
						} else if (
							message.mentions.roles.firstKey() != undefined
						) {
							entity = message.mentions.roles.firstKey();
							whatami = "role";
						} else {
							whatami = "not found";
							return message.reply(
								"your message must contain a mention of user, channel, or an ID of user, channel, or role in order to work (remember not to ping role!)."
							);
						}
					}
				}
				if (whatami == "user" && entity.user.bot) whatami = "bot";
				//USER STATS
				if (whatami == "user") {
					let usertime =
						time.getTime() - entity.user.createdAt.getTime();
					let membertime = time.getTime() - entity.joinedAt.getTime();
					let rolecount = 0;
					let statusicon;
					if (
						entity.presence.status == "online" ||
						entity.presence.status == "idle"
					)
						statusicon = "<:online:823658022974521414>";
					else statusicon = "<:offline:823658022957613076>";

					await entity.roles.cache.each(() => rolecount++);

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
							"https://github.com/KifoPL/kifo-clanker/"
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
							//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
							{
								name: "More",
								value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
							}
						);
				}
				//BOT STATS
				else if (whatami == "bot") {
					let usertime =
						time.getTime() - entity.user.createdAt.getTime();
					let membertime = time.getTime() - entity.joinedAt.getTime();
					let rolecount = 0;
					let statusicon;
					if (
						entity.presence.status == "online" ||
						entity.presence.status == "idle"
					)
						statusicon = "<:online:823658022974521414>";
					else statusicon = "<:offline:823658022957613076>";
					await entity.roles.cache.each(() => rolecount++);
					// .sorted((roleA, roleB) => {
					// 	return roleB.rawPosition - roleA.rawPosition;
					// })

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
							"https://github.com/KifoPL/kifo-clanker/"
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
							//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
							{
								name: "More",
								value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
							}
						);
				}
				//ROLE STATS
				else if (whatami == "role") {
					let rolecreationAt =
						time.getTime() - entity.createdAt.getTime();
					let perms = entity.permissions;
					let membercount = 0;
					await entity.members
						// .sorted((memberA, memberB) => {
						// 	return (
						// 		memberB.roles.highest.rawPosition -
						// 		memberA.roles.highest.rawPosition
						// 	);
						// })
						.each(() => membercount++);
					let strperms = "";
					await perms
						.toArray()
						.forEach(function (item, index, array) {
							strperms += `${item}\n`;
						});

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
							"https://github.com/KifoPL/kifo-clanker/"
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
							//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
							{
								name: "More",
								value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
							}
						);
				}
				//CHANNEL STATS --- NOT YET IMPLEMENTED
				else if (whatami == "channel") {
					message.channel.stopTyping(true);
					return message.reply(
						"channel stats will be implemented one day."
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
							"unsupported channel type! Reach out to KifoPL#3358 to notify him of the error."
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
							"https://github.com/KifoPL/kifo-clanker/"
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
							//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
							{
								name: "More",
								value: "❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
							}
						);
				}
			}
		}

		await message.channel.send(newEmbed).catch((err) => {
			console.error(err);
		});
		message.channel.stopTyping(true);
	},
};
