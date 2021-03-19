module.exports = {
    name: 'stats',
    description: `Displays server stats, or user stats if user provided.`,
    usage: '!kifo stats <opional_user>',
    adminonly: false,
    async execute(message, args, Discord) {
		if (message.guild == null) return message.reply("you can only run this command on the server.");
		message.channel.startTyping().catch();
		const newEmbed = new Discord.MessageEmbed();
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
			await message.guild.members.cache.filter(member => member.presence.status == "online" || member.presence.status == "dnd").each(onlinecount++);
			await message.guild.members.cache.filter(member => member.premiumSince != null).each(member => {
				if (member.user.premiumSince != null) boostcount++;
			})
			await message.guild.roles.cache.each(rolecount++);
			await message.guild.channels().cache.each(channelcount++);
			await message.guild.channels().cache.filter(channel => channel.type == "voice").each(channelvoicecount++);
			await message.guild.channels().cache.filter(channel => channel.type == "text").each(channeltextcount++);
			await message.guild.channels().cache.filter(channel => channel.type == "category").each(channelcategorycount++);
			let time = new Date(Date.now());
			let servertime = time.getTime() - message.guild.createdAt.getTime();
			newEmbed
			.setColor('a039a0')
			.setTitle(message.guild.name + " stats:")
			.setDescription(message.guild.description)
			.setImage(message.guild.bannerURL())
			.setAuthor('KifoPL#3358')
			.setFooter(`${time.toUTCString()}, server created at ${message.guild.createdAt.toUTCString()}, it is ${ms(servertime, {long : true})} old.`)
			.addFields(
				{name: "Member Count:", value: `Users: ${message.guild.members - botcount} (${onlinecount} online), Bots: ${botcount}, Total: ${message.guild.members}.`},
				{name: `Boosts status:`, value: `Tier ${message.guild.premiumTier}, thanks to ${message.guild.premiumSubscriptionCount} boosts from ${boostcount} members.`},
				{name: `Region`, value: `${message.guild.region}`},
				{name: `Roles`, value: `${rolecount}`},
				{name: `Channels`, value: `${channelvoicecount} voice channels, ${channeltextcount} text channels, ${channelcategorycount} categories, Total: ${channelcount}.`},
				{name: "More", value: "If you want this command to have more stats, reach out to this bot developer!"}
			)
		}
		message.channel.send(newEmbed).catch();
		message.channel.stopTyping().catch();
    }
}