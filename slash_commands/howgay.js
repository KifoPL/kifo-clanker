const Discord = require("discord.js");
module.exports = {
	name: "howgay",
	description: `A quick test to find out your gayness level.`,
	options: [
		{
			name: "user",
			type: "USER",
			description: "A subject of measurement.",
		},
	],
	usage: [
		"`howgay <optional_user>` - accurately measures sexual thirst towards the same gender.",
	],
	guildonly: true,
	category: "FUN",
	perms: ["USE_SLASH_COMMANDS"],
	execute(itr) {
		let userid =
			itr.options.data.find((o) => o.name === "user")?.value ??
			itr.user.id;

		let username = itr.guild.members.resolve(userid)?.displayName;

		calculate(userid, itr.guildId).then((field) => {
			const newEmbed = new Discord.MessageEmbed()
				.setColor("a039a0")
				.setTitle(username + "'s gay level is:")
				.addField(field.name, field.value);
			itr.reply({ embeds: [newEmbed] }).catch();
		});
	},
	calculate: calculate,
};

async function calculate(userid, guildid) {
	return new Promise((resolve, reject) => {
		let Troll = false;
		if (userid == 289119054130839552 || userid == 795638549730295820)
			Troll = true;
		let reply = "";
		let comment = "";
		let howgay = (userid + guildid) % 101;
		if (!Troll) {
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
		resolve({ name: reply, value: comment });
	});
}
