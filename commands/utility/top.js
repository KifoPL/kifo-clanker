module.exports = {
	name: "top",
	description:
		"This command lists x messages with most reactions from other channel.",
	usage: ["`top <x> <time_period> <other_channel> <reaction>` - lists top x messages with most reactions from other channel. Sends x embeds (don't set it too large)."],
	//I'm making it admin only because no one else used it anyway.
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	async execute(message, args, Discord) {
		//This is for timestamps
		const ms = require(`ms`);
		const kifo = require("kifo");
		if (message.guild == null)
			return message.reply(kifo.embed(
				"you can only run this command on the server."
			));
		if (
			!message.member
				.permissionsIn(message.channel)
				.has("MANAGE_CHANNELS")
		)
			return message.reply(kifo.embed(
				"You do not have `MANAGE_CHANNELS` permissions."
			));
		if (!args[3])
			return message.reply(kifo.embed(`insufficient arguments. Use ${this.usage}`));
		if (isNaN(args[0])) return message.reply(kifo.embed("incorrect amount of posts."));
		if (args[0] < 1 || args[0] > 100)
			return message.reply(kifo.embed(
				"incorrect amount of posts. You must select at least 1, but not more than 100."
			));
		let x = args[0];
		if (isNaN(ms(args[1])))
			return message.reply(kifo.embed(
				"incorrect time period. Please specify correct time period."
			));
		if (ms(args[1]) < ms("10s") || ms(args[1]) > ms("14d"))
			return message.reply(kifo.embed(
				"incorrect amount of time. For the command to work, please input period of time that is between 10 seconds and 14 days."
			));
		if (
			message.guild.channels.cache.find(
				(channel) => channel.id == args[2].slice(2, 20)
			) == undefined
		)
			return message.reply(kifo.embed(
				"channel does not exist. Please input correct channel."
			));
		if (
			message.guild.emojis.cache.find(
				(emojis) =>
					emojis.id ==
					args[3].slice(args[3].length - 19, args[3].length - 1)
			) == undefined
		)
			return message.reply(kifo.embed(
				"this reaction does not exist / is not from this server. Please use only emotes from this server."
			));
		if (args[4] != undefined)
			return message.reply(kifo.embed(`too many arguments! Use ${this.usage}`));

		function place(number) {
			if (number % 10 == 1 && number % 100 != 11) return `st`;
			if (number % 10 == 2 && number % 100 != 12) return "nd";
			if (number % 10 == 3 && number % 100 != 13) return "rd";
			else return "th";
		}

		let now = Date.now();
		let whichchannel = message.channel.guild.channels.cache.find(
			(channel) => channel.id == args[2].slice(2, 20)
		);
		if (
			!message.guild.me
				.permissionsIn(whichchannel)
				.has("VIEW_CHANNEL")
		)
			return message.reply(kifo.embed(
				"I do not have `VIEW_CHANNEL` permissions in " +
					"<#" +
					whichchannel.id +
					">"
			));
		if (
			!message.guild.me
				.permissionsIn(whichchannel)
				.has("VIEW_CHANNEL")
		)
			return message.reply(kifo.embed(
				"I do not have `READ_MESSAGE_HISTORY` permissions in " +
					"<#" +
					whichchannel.id +
					">"
			));
		if (
			!message.guild.me.permissionsIn(message.channel).has("ATTACH_FILES")
		)
			return message.reply(kifo.embed(
				"I do not have `ATTACH_FILES` permissions in this channel."
			));
		if (!message.member.permissionsIn(whichchannel).has("MANAGE_CHANNELS"))
			return message.reply(kifo.embed(
				"You need to have `MANAGE_CHANNELS` permissions in <#" +
					whichchannel.id +
					">"
			));
		let chmessages = [];
		let key = args[3].slice(args[3].length - 19, args[3].length - 1);

		let messageCollection = new Discord.Collection();
		let fetchoptions = { before: null, limit: 100 }
		let startTime = now - ms(args[1]);
		let continueloop = true;
		while (continueloop) {
			await whichchannel.messages.fetch(fetchoptions, true).then(async (fetchedMessages) => {
				let sweeps = await fetchedMessages.sweep(msg => msg.createdAt < startTime);
				if (sweeps > 0) {
					continueloop = false;
				}
				messageCollection = messageCollection.concat(fetchedMessages);
				if (fetchedMessages.size < 100) continueloop = false;
				if (continueloop) {
					let oldestMessage = await fetchedMessages.first();
					fetchedMessages.each(msg => {
						if (oldestMessage.createdAt > msg.createdAt) {
							oldestMessage = msg;
						}
					})
					fetchoptions.before = oldestMessage.id;
				}
			})
		}
		messageCollection = messageCollection
		.filter((m) => now - m.createdTimestamp <= ms(args[1]))
		.filter((m) => m.reactions.resolve(key) != undefined)
		chmessages = messageCollection.array();
		// // await whichchannel.messages
		// // 	.fetch()
		// // 	.then((messages) =>
		// // 		messages.filter((m) => now - m.createdTimestamp <= ms(args[1]))
		// // 	)
		// // 	.then((messages) =>
		// // 		messages.filter((m) => m.reactions.resolve(key) != undefined)
		// // 	)
		// // 	.then((messages) => (chmessages = messages.array()))
		// // 	.catch((err) => console.log(err));
		if (!chmessages[0])
			return message.reply(kifo.embed(
				"no posts found matching criteria. Maybe try longer time period?"
			));
		chmessages.sort((a, b) => {
			if (
				b.reactions.cache.find(
					(reaction) =>
						reaction.emoji.id ==
						args[3].slice(args[3].length - 19, args[3].length - 1)
				) == undefined
			) {
				return -1;
			}
			if (
				a.reactions.cache.find(
					(reaction) =>
						reaction.emoji.id ==
						args[3].slice(args[3].length - 19, args[3].length - 1)
				) == undefined
			) {
				return 1;
			}
			return (
				b.reactions.resolve(key).count - a.reactions.resolve(key).count
			);
		});
		let loops = 0;
		if (!chmessages[x]) {
			while (chmessages[loops] != undefined) loops++;
		} else loops = x;
		let ii = 1;
		let userids = [];
		message.channel.startTyping();
		for (i = 0; i < loops; i++) {
			//one person can only get one place.
			if (
				userids.find((userid) => userid == chmessages[i].author.id) !=
				undefined
			) {
				loops++;
				if (!chmessages[loops]) {
					loops--;
				}
			} else {
				userids.push(chmessages[i].author.id);

				const newEmbed = new Discord.MessageEmbed();
				newEmbed.setColor("a039a0");
				newEmbed.setThumbnail(
					chmessages[i].author.displayAvatarURL({
						format: "png",
						dynamic: true,
						size: 64,
					})
				);
				newEmbed.setAuthor(
					"Powered by top",
					message.guild.me?.user?.avatarURL({
						format: "png",
						dynamic: true,
						size: 32,
					}),
					"https://kifopl.github.io/kifo-clanker/wiki"
				);

				//if two posts have the same amount of upvotes, they're equal place
				if (
					i > 0 &&
					chmessages[i].reactions.resolve(key).count ==
						chmessages[i - 1].reactions.resolve(key).count
				) {
					loops++;
					ii--;
					if (!chmessages[loops]) {
						loops--;
					}
				}

				message.channel.startTyping().catch();
				newEmbed.setTitle(
					"**" +
						ii +
						place(ii) +
						"** place by **" +
						chmessages[i].author.username +
						"** with **" +
						chmessages[i].reactions.resolve(key).count +
						"** <:" +
						chmessages[i].reactions.resolve(key).name +
						":" +
						key +
						">"
				);

				if (chmessages[i].content.length > 0) {
					newEmbed.setDescription(chmessages[i].content.length > 420 ? `${chmessages[i].content.slice(0,420)}...` : chmessages[i].content);
				}

				if (
					chmessages[i].attachments.array().length > 0 &&
					chmessages[i].attachments.array()[0] != undefined
				) {
					newEmbed.setImage(chmessages[i].attachments.array()[0].url);
				}
				newEmbed.setURL(
					`https://discord.com/channels/${chmessages[i].channel.guild.id}/${chmessages[i].channel.id}/${chmessages[i].id}`
				);
				message.channel.send(newEmbed).catch();
				ii++;
			}
			//message.channel.startTyping().catch();
		}
		message.channel.stopTyping(true);
		if (loops < args[0])
			message.channel
				.send("No more posts with given criteria found.")
				.catch();
	},
};
