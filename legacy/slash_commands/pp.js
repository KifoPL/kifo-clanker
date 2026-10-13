const Discord = require("discord.js");
module.exports = {
	name: "pp",
	description: `Measure your PP length with this totally reliable pp length calculator.`,
	options: [
		{
			name: "user",
			type: "USER",
			description: "A subject of measurement.",
		},
	],
	usage: [
		"`pp <optional_user>` - absolutely accurate measurement of pp length.",
	],
	category: "FUN",
	guildonly: true,
	perms: ["USE_APPLICATION_COMMANDS"],
	execute(itr) {
		let userid =
			itr.options.data.find((o) => o.name === "user")?.value ??
			itr.user.id;

		let username = itr.guild.members.resolve(userid)?.displayName;

		calculate(userid, itr.guildId).then((field) => {
			const newEmbed = new Discord.MessageEmbed()
				.setColor("a039a0")
				.setTitle(username + "'s pp length is:")
				.addField(field.name, field.value);
			itr.reply({ embeds: [newEmbed] }).catch();
		});
	},
	calculate: calculate,
};

async function calculate(userid, guildid) {
	return new Promise((resolve, reject) => {
		let pplen = 0;
		let pp = "8";
		let Troll = false;
		let ppvalue = "";
		if (userid == 289119054130839552 || userid == 795638549730295820)
			Troll = true;
		let reply = "";
		let comment = "";
		if (!Troll) {
			pplen = (userid + guildid) % 13;
			for (i = 0; i < pplen; i++) pp += "=";
			pp += "D";

			ppvalue = (((userid + guildid) % 13) + 2) * 2 + " cm";
		} else {
			pp = "8==============================D";
			ppvalue = "69 cm";
		}
		const returnField = { name: pp, value: ppvalue };
		resolve(returnField);
	});
}
