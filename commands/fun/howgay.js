module.exports = {
	name: "howgay",
	description: `A quick test to find out your gayness level.`,
	usage: [
		"`howgay <optional_user>` - accurately measures sexual thirst towards the same gender.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, Discord, isStats = false, userID = 0) {
		const kifo = require("kifo");
		let userid = 0;
		let howgay = 0;
		let reply = "";
		let comment = "";
		let Troll = false;
		if (userID != 0) args[0] = userID;
		if (args[0]) {
			if (!isNaN(args[0])) {
				//console.log(message.guild.members.resolve(args[0]));
				if (
					args[0] == 289119054130839552 ||
					args[0] == 795638549730295820
				) {
					Troll = true;
				} else if (!message.guild.members.resolve(args[0]))
					return message.reply(kifo.embed("user not found."));
				userid = args[0];
			} else {
				if (message.mentions.users.firstKey() != undefined) {
					if (
						!message.guild.members.resolve(
							message.mentions.users.firstKey()
						)
					)
						return message.reply(kifo.embed("user not found."));
					if (
						message.mentions.users.firstKey() ==
							289119054130839552 ||
						message.mentions.users.firstKey() == 795638549730295820
					)
						Troll = true;
					userid = message.mentions.users.firstKey();
				}
				return message.reply(
					kifo.embed("Either tag or provide user's ID.")
				);
			}
		} else {
			if (message.mentions.users.firstKey() != undefined) {
				if (
					!message.guild.members.resolve(
						message.mentions.users.firstKey()
					)
				)
					return message.reply(kifo.embed("user not found."));
				if (
					message.mentions.users.firstKey() == 289119054130839552 ||
					message.mentions.users.firstKey() == 795638549730295820
				)
					Troll = true;
				userid = message.mentions.users.firstKey();
			}
			userid = message.author.id;
		}
		if (userid == 289119054130839552 || args[0] == 795638549730295820)
			Troll = true;
		let username = message.guild.members.resolve(userid).displayName;
		if (!Troll) {
			howgay = (userid + message.guild.id) % 101;
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

		const returnField = { name: reply, value: comment };
		if (isStats === true) return returnField;
		const newEmbed = new Discord.MessageEmbed()
			.setColor("a039a0")
			.setTitle(username + "'s gay level is:")
			.addField(returnField);
		message.channel.send(newEmbed).catch();
	},
};
