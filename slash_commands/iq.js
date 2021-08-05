const Discord = require("discord.js");
module.exports = {
	name: "iq",
	description: `A very quick and accurate IQ test.`,
	options: [
		{
			name: "user",
			type: "USER",
			description: "A subject of measurement.",
		},
	],
	usage: ["`iq <optional_user>` - A quick and reliable IQ test."],
	category: "FUN",
	guildonly: true,
	perms: ["USE_SLASH_COMMANDS"],
	execute(itr) {
		let userid =
			itr.options.data.find((o) => o.name === "user")?.value ??
			itr.user.id;

		let username = itr.guild.members.resolve(userid)?.displayName;
		let Troll = false;
		if (userid == 289119054130839552 || userid == 795638549730295820)
			Troll = true;
		

		calculate(userid, itr.guildId).then((field) => {
			const newEmbed = new Discord.MessageEmbed()
				.setColor("a039a0")
				.setTitle(username + "'s IQ level is:")
				.addField(field.name, field.value);
			if (Troll)
				newEmbed.setImage(
					`https://media1.tenor.com/images/8ac74d59bf920c9588c8f7f00229cb78/tenor.gif`
				);
			itr.reply({ embeds: [newEmbed] }).catch();
		});
	},
	calculate: calculate,
};

async function calculate(userid, guildid) {
	return new Promise((resolve, reject) => {
		let iq = 0;
		let reply = "";
		let comment = "";
		let Troll = false;
		if (userid == 289119054130839552 || userid == 795638549730295820)
			Troll = true;
		if (!Troll) {
			iq = ((userid + guildid) % 251) + 50; // 50 <= IQ <= 300
			reply = iq + " IQ";
			if (iq == 69) comment = "Nice.";
			else if (iq < 75) comment = "Back to school, kiddo.";
			else if (iq < 100) comment = "You should start reading some books.";
			else if (iq < 125)
				comment = "You're smart... for a Jar Jar (the non-cannon one).";
			else if (iq < 150)
				comment = "Deathsticks' dealer would be proud of you.";
			else if (iq < 175)
				comment = "You are reaching an IQ level of chimpanzee.";
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
		const returnField = { name: reply, value: comment };
		resolve(returnField);
	});
}
