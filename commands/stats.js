module.exports = {
	name: "stats",
	description: `Displays server stats, or user stats if user provided.`,
	usage: "!kifo stats <opional_user>",
	adminonly: false,
	async execute(message, args, Discord) {
		//This is for timestamps
		const ms = require(`ms`);

		function place(number) {
			if (number % 10 == 1) return `st`;
			if (number % 10 == 2) return "nd";
			if (number % 10 == 3) return "rd";
			else return "th";
		}

		//PRECHECKS
		if (message.guild == null)
			return message.reply(
				"you can only run this command on the server."
			);
		if (args[1] != undefined) return message.reply("too many arguments!");
		message.channel.startTyping().catch();
		const newEmbed = new Discord.MessageEmbed();
		let time = new Date(Date.now());
		let guildcount = 0;

		message.client.guilds.cache.each(() => {
			guildcount++;
		});
		let serverrolecount = 0;
		await message.guild.roles.cache.each(() => serverrolecount++);

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
			await message.guild.members.cache.each((member) => {
				if (member.user.bot) botcount++;
			});
			await message.guild.members.cache
				.filter(
					(member) =>
						member.presence.status != "offline" && !member.user.bot
				)
				.each(() => onlinecount++);
			await message.guild.members.cache.each((member) => {
				if (member.premiumSinceTimestamp != undefined) boostcount++;
			});
			await message.guild.channels.cache.each(() => channelcount++);
			await message.guild.channels.cache
				.filter((channel) => channel.type == "voice")
				.each(() => channelvoicecount++);
			await message.guild.channels.cache
				.filter((channel) => channel.type == "text")
				.each(() => channeltextcount++);
			await message.guild.channels.cache
				.filter((channel) => channel.type == "category")
				.each(() => channelcategorycount++);

			let servertime = time.getTime() - message.guild.createdAt.getTime();
			newEmbed
				.setColor("a039a0")
				.setTitle(
					message.guild.name + ` stats: ||also try "!kifo stats me"||`
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
						value: `<:voice:823658022684721164> ${channelvoicecount} voice channels, <:textchannel:823658022849085512> ${channeltextcount} text channels, <:category:823658022706217011> ${channelcategorycount} categories, Total: ${channelcount}.`,
					},
					// {name: `\u200B`, value: `\u200B`},
					{
						name: "More",
						value:
							"❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
					}
				);
		} else {
			//NOT SERVER STATS (user, bot, role, channel)
			let entity;
			let whatami = `assign to either "user | bot | role | channel | not found"`;
			const ppcmd = await require(`./pp.js`);
			const howgaycmd = await require(`./howgay.js`);
			const iqcmd = await require(`./iq.js`);

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
					} else if (message.mentions.roles.firstKey() != undefined) {
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
				let usertime = time.getTime() - entity.user.createdAt.getTime();
				let membertime = time.getTime() - entity.joinedAt.getTime();
				let rolecount = 0;
				let statusicon;
				if (
					entity.presence.status == "online" ||
					entity.presence.status == "idle"
				)
					statusicon = "<:online:823658022974521414>";
				else statusicon = "<:offline:823658022957613076>";
				await entity.roles.cache.each((role) => rolecount++);

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
							value:
								"❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
						}
					);
			}
			//BOT STATS
			else if (whatami == "bot") {
				let usertime = time.getTime() - entity.user.createdAt.getTime();
				let membertime = time.getTime() - entity.joinedAt.getTime();
				let rolecount = 0;
				let statusicon;
				if (
					entity.presence.status == "online" ||
					entity.presence.status == "idle"
				)
					statusicon = "<:online:823658022974521414>";
				else statusicon = "<:offline:823658022957613076>";
				await entity.roles.cache.each((role) => rolecount++);
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
						message.guild.me?.user?.avatarURL({
							format: "png",
							dynamic: true,
							size: 64,
						}),
						"https://github.com/KifoPL/kifo-clanker/"
					)
					.setFooter(
						`Bot created at: ${entity.user.createdAt.toUTCString()}\Bot joined server at: ${entity.joinedAt.toUTCString()}, ${ms(
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
						)} after bot creation).`
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
							value:
								"❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
						}
					);
			}
			//ROLE STATS
			else if (whatami == "role") {
				let rolecreationAt =
					time.getTime() - entity.createdAt.getTime();
				let perms = entity.permissions;
				let membercount = 0;
				await entity.members.each(() => membercount++);
				let strperms = "";
				await perms.toArray().forEach(function (item, index, array) {
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
						`Role created at: ${entity.createdAt.toUTCString()}, ${ms(
							rolecreationAt
						)} ago, ${ms(
							entity.createdAt - message.guild.createdAt
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
							name: `Is mentionable by anyone?`,
							value: `${entity.mentionable ? "Yes." : "No."}`,
							inline: true,
						},
						{
							name: `Permissions:`,
							value: `${strperms}`,
						},
						//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
						{
							name: "More",
							value:
								"❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358, <@289119054130839552>)!",
						}
					);
			}
			else if (whatami == "channel") {
				return message.reply("channel stats will be implemented one day.");
			}
		}
		message.channel.send(newEmbed).catch();
		message.channel.stopTyping(true);
	},
};
