module.exports = {
    name: 'stats',
    description: `Displays server stats, or user stats if user provided.`,
    usage: '!kifo stats <opional_user>',
    adminonly: false,
    async execute(message, args, Discord) {
		//This is for timestamps
		const ms = require(`ms`);
		if (message.guild == null) return message.reply("you can only run this command on the server.");
		if (args[1] != undefined) return message.reply("too many arguments!");
		message.channel.startTyping().catch();
		const newEmbed = new Discord.MessageEmbed();
		let time = new Date(Date.now());
        if (args[0] == undefined)
		{
			let botcount = 0;
			let onlinecount = 0;
			let boostcount = 0;
			let rolecount = 0;
			let channelcount = 0;
			let channelvoicecount = 0;
			let channeltextcount = 0;
			let channelcategorycount = 0;
			await message.guild.members.cache.filter(member => member.user.bot).each(member => {
				if (member.user.bot) botcount++;
			})
			await message.guild.members.cache.filter(member => member.presence.status != "offline").each(member => onlinecount++);
			await message.guild.members.cache.filter(member => !isNaN(member.premiumSinceTimestamp)).each(member => boostcount++)
			await message.guild.roles.cache.each(member => rolecount++);
			await message.guild.channels.cache.each(member => channelcount++);
			await message.guild.channels.cache.filter(channel => channel.type == "voice").each(member => channelvoicecount++);
			await message.guild.channels.cache.filter(channel => channel.type == "text").each(member => channeltextcount++);
			await message.guild.channels.cache.filter(channel => channel.type == "category").each(member => channelcategorycount++);
			
			let servertime = time.getTime() - message.guild.createdAt.getTime();
			newEmbed
			.setColor('a039a0')
			.setTitle(message.guild.name + ` stats: ||also try "!kifo stats me"||`)
			.setDescription(message.guild.description)
			.setImage(message.guild.bannerURL())
			.setAuthor('Kifo Clanker™, by KifoPL#3358')
			.setFooter(`Server created at ${message.guild.createdAt.toUTCString()}, it is ${ms(servertime, {long : true})} old (current time: ${time.toUTCString()}).`)
			.addFields(
				{name: "Member Count:", value: `Users: ${message.guild.memberCount - botcount} (${onlinecount} online), Bots: ${botcount}, Total: ${message.guild.memberCount}.`},
				{name: `Boosts status:`, value: `Tier ${message.guild.premiumTier}, thanks to ${message.guild.premiumSubscriptionCount} boosts from ${boostcount} members.`},
				{name: `Region`, value: `${message.guild.region}`},
				{name: `Roles`, value: `${rolecount}`},
				{name: `Channels`, value: `${channelvoicecount} voice channels, ${channeltextcount} text channels, ${channelcategorycount} categories, Total: ${channelcount}.`},
				//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
				{name: "More", value: "If you want this command to have more stats, reach out to bot developer (KifoPL#3358)!"}
			)
		}
		else
		{
			let member;
			if (args[0].toUpperCase() == "ME")
			{
				member = message.member;
			}
			else
			{
				if (!isNaN(args[0]))
				{
					if (!message.guild.members.resolve(args[0])) return message.reply("user not found.");
					member = message.guild.members.cache.find(member => member.id == args[0]);
				}
				else
				{
					if (message.mentions.users.firstKey() != undefined)
					{
						if (!message.guild.members.resolve(message.mentions.users.firstKey())) return message.reply("user not found.");
						member = message.mentions.users.first();
					}
				}
			}
			let usertime = time.getTime() - member.user.createdAt.getTime();
			let membertime = time.getTime() - member.joinedAt.getTime();
			let rolecount = 0;
			await (member.roles.cache.each(role => rolecount++));
			newEmbed
			.setColor('a039a0')
			.setTitle(`${member.displayName} stats:`)
			//.setDescription(`${member.nickname ?? "none"}`)
			.setImage(message.guild.bannerURL())
			.setAuthor('Kifo Clanker™, by KifoPL#3358')
			.setFooter(`Account created at: ${member.user.createdAt.toUTCString()}\nAccount joined server at: ${member.joinedAt.toUTCString()}\nIt is ${ms(usertime, {long : true})} old\nIt joined server ${ms(membertime, {long : true})} ago (current time: ${time.toUTCString()}).`)
			.addFields(
				{name: "Info", value: `<@${member.user.tag}>, ${member.nickname == undefined ? "No nickname set" : member.nickname }, ${member.user.tag}.`},
				{name: `Boost status:`, value: `${member.premiumSince != undefined ? `Boosting since ${member.premiumSince.toUTCString()}, that's ${ms(time - member.premiumSince.getTime(), {long : true})}!` : `Not boosting... ***yet***.`}`},
				{name: `Roles`, value: `${rolecount} roles, highest role is ${member.roles.highest.name}, hoisted as ${member.roles.hoist.name}.`},
				{name: `Status`, value: `User is currently ${member.presence.status}.`},
				//{name: "Also:", value: `You can check your own stats with "!kifo stats me", or someone else's stats by ${this.usage}`},
				{name: "More", value: "If you want this command to have more stats, reach out to bot developer (KifoPL#3358)!"}
			)
		}
		message.channel.send(newEmbed).catch();
		message.channel.stopTyping();
    }
}