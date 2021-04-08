module.exports = {
	name: "iq",
	description: `A very quick and accurate IQ test.`,
	usage: "!kifo iq <optional_user>",
	adminonly: false,
	execute(message, args, Discord) {
		let userid = 0;
		let iq = 0;
		let reply = "";
		let comment = "";
		let Troll = false;
		if (args[0]) {
			if (!isNaN(args[0])) {
				//console.log(message.guild.members.resolve(args[0]));
				if (
					args[0] == 289119054130839552 ||
					args[0] == 795638549730295820
				) {
					Troll = true;
				} else if (!message.guild.members.resolve(args[0]))
					return message.reply("user not found.");
				userid = args[0];
			} else {
				if (message.mentions.users.firstKey() != undefined) {
					if (
						!message.guild.members.resolve(
							message.mentions.users.firstKey()
						)
					)
						return message.reply("user not found.");
					if (
						message.mentions.users.firstKey() ==
							289119054130839552 ||
						message.mentions.users.firstKey() == 795638549730295820
					)
						Troll = true;
					userid = message.mentions.users.firstKey();
				}
			}
		} else userid = message.author.id;
		if (userid == 289119054130839552 || args[0] == 795638549730295820)
			Troll = true;
		let username = message.guild.members.resolve(userid).displayName;
		if (!Troll) {
			iq = (userid % 251) + 50; // 50 <= IQ <= 300
			reply = iq + " IQ";
			if (iq == 69) comment = "Nice.";
			else if (iq < 75) comment = "Back to school, kiddo.";
			else if (iq < 100) comment = "You should start reading some books.";
			else if (iq < 125)
				comment = "You're smart... for a Jar Jar (the non-cannon one).";
			else if (iq < 150)
				comment = "Deathsticks' dealer would be proud of you.";
			else if (iq < 175)
				comment = "You are reaching an IQ level of chimpanzee";
			else if (iq < 200)
				comment = "Taking IQ test twice doesn't add the result.";
			else if (iq < 225)
				comment = "An average amount of stupidity and intelligence.";
			else if (iq < 250)
				comment = "You're like Rick, except he's a pickle.";
			else if (iq < 275) comment = "Try applying to uni for a degree.";
			else if (iq < 300) comment = "Guess you're smart or sth, idk.";
			else
				comment = "Your brain is so big it can't fit through the door.";
		} else {
			reply = "420 IQ";
			comment = `Yeah, this is big brain time.`;
		}
		//console.log(userid, iq, comment);

		const newEmbed = new Discord.MessageEmbed()
			.setColor("a039a0")
			.setTitle(username + "'s IQ level is:")
			.addFields({ name: reply, value: comment });
		if (Troll)
			newEmbed.setImage(
				`https://media1.tenor.com/images/8ac74d59bf920c9588c8f7f00229cb78/tenor.gif`
			);
		message.channel.send(newEmbed).catch();
	},
};
