const Discord = require("discord.js");
module.exports = {
	name: "pp",
	description: `Measure your PP length with this totally reliable pp length calculator. Each user has his own constant pp length (like irl), it's not random.`,
	usage: [
		"`pp <optional_user>` - absolutely accurate measurement of pp length.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, isStats = false, userId = 0) {
		const kifo = require("kifo");
		let userid = args[0] ?? message.author.id;

		let pplen = 0;
		let pp = "8";
		let Troll = false;
		let ppvalue = "";
		if (userId != 0) userid = userId;
		if (userid) {
			if (!isNaN(userid)) {
				//console.log(message.guild.members.resolve(args[0]));
				if (
					userid == 289119054130839552 ||
					userid == 795638549730295820
				) {
					Troll = true;
				} else if (!message.guild.members.resolve(userid))
					return message.reply({ embeds: [kifo.embed("user not found.")] });
				userid = userid;
			} else {
				if (message.mentions.users.firstKey() != undefined) {
					if (
						!message.guild.members.resolve(
							message.mentions.users.firstKey()
						)
					)
						return message.reply({ embeds: [kifo.embed("user not found.")] });
					if (
						message.mentions.users.firstKey() ==
						289119054130839552 ||
						message.mentions.users.firstKey() == 795638549730295820
					)
						Troll = true;
					userid = message.mentions.users.firstKey();
				} else
					return message.reply({
						embeds: [
							kifo.embed("Either tag or provide user's Id.")
						]
					});
			}
		} else {
			userid = message.author.id;
		}
		if (userid == 289119054130839552 || userid == 795638549730295820)
			Troll = true;
		let username = message.guild.members.resolve(userid).displayName;
		if (!Troll) {
			pplen = (userid + message.guild.id) % 13;
			for (i = 0; i < pplen; i++) pp += "=";
			pp += "D";

			ppvalue = (((userid + message.guild.id) % 13) + 2) * 2 + " cm";
		} else {
			pp = "8==============================D";
			ppvalue = "69 cm";
		}
		const returnField = { name: pp, value: ppvalue };
		if (isStats === true) return returnField;
		const newEmbed = new Discord.MessageEmbed()
			.setColor("a039a0")
			.setTitle(username + "'s PP:")
			.addField(pp, ppvalue);
		message.reply({ embeds: [newEmbed] }).catch();
	},
};
