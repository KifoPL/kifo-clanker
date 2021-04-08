module.exports = {
	name: "howgay",
	description: `A quick test to find out your gayness level.`,
	usage: "!kifo howgay <optional_user>",
	adminonly: false,
	execute(message, args, Discord) {
		let userid = 0;
		let howgay = 0;
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
			howgay = userid % 101;
			reply = howgay + "%";
			if (howgay == 69) comment = "Nice.";
			else if (howgay == 50)
				comment = "That's just bisexual with extra steps.";
			else if (howgay < 10) comment = "Damn bro you're straight.";
			else if (howgay < 20)
				comment = "That's just kissing the homies goodnight.";
			else if (howgay < 30)
				comment =
					"Typical person except you fell in love with Ricardo.";
			else if (howgay < 40)
				comment = "More straight than a banana, that's for sure.";
			else if (howgay < 50)
				comment =
					"You are somewhat gay. No need to thank for a professional diagnosis.";
			else if (howgay < 60)
				comment = "You'd choose Ewan McGregor over Natalie Portman.";
			else if (howgay < 70)
				comment = "You like sand more than the other gender.";
			else if (howgay < 80)
				comment = "This is getting out of hand! Now you are gay.";
			else if (howgay < 90) comment = "Why are you gay?";
			else if (howgay < 100)
				comment = "You're with him! You brought him to #### me!";
			else comment = "Who are you, so wise in the ways of the gays?";
		} else {
			reply = "-1%";
			comment = `How is that possible, you may wonder?\n"The Dark Side of The Force is a pathway to many abilities, some consider to be unnatural."`;
		}
		//console.log(userid, howgay, comment);

		const newEmbed = new Discord.MessageEmbed()
			.setColor("a039a0")
			.setTitle(username + "'s gay level is:")
			.addFields({ name: reply, value: comment });
		message.channel.send(newEmbed).catch();
	},
};
