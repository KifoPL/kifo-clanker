module.exports = {
	name: "stats",
	description: `Displays server stats, or user stats if user provided.`,
	usage: "!kifo stats <opional_user>",
	adminonly: false,
	async execute(message, args, Discord) {
		//This is for timestamps
		const ms = require(`ms`);

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

		if (args[0] == undefined) {
			let owner = message.guild.owner;
			let botcount = 0;
			let onlinecount = 0;
			let boostcount = 0;
			let rolecount = 0;
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
			await message.guild.roles.cache.each(() => rolecount++);
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
						: ""
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
						value: `<:boost:823658698412392449> Tier ${message.guild.premiumTier}, thanks to ${message.guild.premiumSubscriptionCount} boosts. ${boostcount} members boosted throughout server's existence.`,
					},
					{
						name: `Region`,
						value: `${message.guild.region}`,
						inline: true,
					},
					{
						name: `Roles`,
						value: `<:role:823658022948700240> ${rolecount}`,
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
							"❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358)!",
					}
				);
		} else {
			let member;
			if (args[0].toUpperCase() == "ME") {
				member = message.member;
			} else {
				if (!isNaN(args[0])) {
					if (!message.guild.members.resolve(args[0]))
						return message.reply("user not found.");
					member = message.guild.members.cache.find(
						(member) => member.id == args[0]
					);
				} else {
					if (message.mentions.users.firstKey() != undefined) {
						if (
							!message.guild.members.resolve(
								message.mentions.users.firstKey()
							)
						)
							return message.reply("user not found.");
						member = message.mentions.members.first();
					}
				}
			}
			if (member.user.bot) {
				message.channel.stopTyping(true);
				return message.reply("you can't check bot stats for now.");
			}
			let usertime = time.getTime() - member.user.createdAt.getTime();
			let membertime = time.getTime() - member.joinedAt.getTime();
			let rolecount = 0;
			let statusicon;
			if (
				member.presence.status == "online" ||
				member.presence.status == "idle"
			)
				statusicon = "<:online:823658022974521414>";
			else statusicon = "<:offline:823658022957613076>";
			await member.roles.cache.each((role) => rolecount++);
			newEmbed
				.setColor("a039a0")
				.setTitle(`${member.displayName} stats:`)
				//.setDescription(`${member.nickname ?? "none"}`)
				.setImage(
					member.user.displayAvatarURL({
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
					`Account created at: ${member.user.createdAt.toUTCString()}\nAccount joined server at: ${member.joinedAt.toUTCString()}, ${ms(
						member.joinedAt.getTime() -
							member.guild.createdAt.getTime(),
						{ long: true }
					)} after server creation.\nIt is ${ms(usertime, {
						long: true,
					})} old.\nIt joined server ${ms(membertime, {
						long: true,
					})} ago (it joined ${ms(
						member.joinedAt.getTime() -
							member.user.createdAt.getTime(),
						{ long: true }
					)} after server creation).\n${
						member.joinedAt.getTime() -
							member.user.createdAt.getTime() <
						ms("1h")
							? `It *could* be an alt.`
							: `It *probably* isn't alt.`
					}`
				)
				.addFields(
					{
						name: "Info",
						value: `<:info:823907804200435713> <@${
							member.user.id
						}>, ${
							member.nickname == undefined
								? "No nickname set,"
								: `${member.nickname}, AKA`
						} ${member.user.tag}.`,
					},
					{
						name: `Boost status:`,
						value: `<:boost:823658698412392449> ${
							member.premiumSince != undefined
								? `Boosting since ${member.premiumSince.toUTCString()}, that's ${ms(
										time - member.premiumSince.getTime(),
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
										member.roles?.highest?.name
								  }, ${
										member.roles?.hoist?.name == undefined
											? `not hoisted`
											: `\nhoisted as <:hoist:823907804141322311> ${member.roles?.hoist?.name}`
								  }.`
								: `This account has no roles yet.`
						}`,
					},
					{
						name: `Status`,
						value: `${statusicon} User is currently **${member.presence.status}**.`,
					},
					//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
					{
						name: "More",
						value:
							"❗ If you want this command to have more stats, reach out to bot developer (KifoPL#3358)!",
					}
				);
		}
		message.channel.send(newEmbed).catch();
		message.channel.stopTyping(true);
	},
};
