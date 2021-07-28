const Discord = require("discord.js");
const api = require("detectlanguage")
const kifo = require("kifo")
const countries = require("countries-list")
module.exports = {
	name: "lang",
	description: "This command allows you to detect message language.",
	usage: [
		"`lang <message_id_or_url>` - sends a DM with description (react with any emote to the message to delete it).",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args) {
		if (!args[0]) {
			return message.reply({ embeds: [kifo.embed("Specify the message using URL or Id!")] }).catch(() => { })
		}
		let msgId = args[0];
		if (msgId.match(kifo.urlRegex())) {
			let tempArr = msgId.split("/")
			msgId = tempArr[tempArr.length - 1]
		}
		message.channel.messages.fetch(msgId).then(msg => {
			var dtlang = new api(process.env.LANGUAGE_DETECT_KEY);
			dtlang.detect(msg.content).then(async (result) => {
				if (result.length > 0) {
					const date = new Date(Date.now())
					let newEmbed = new Discord.MessageEmbed()
						.setTitle("Detected language:")
						.setColor("a039a0")
						.setAuthor(
							"Powered by Kifo Clanker™",
							message.guild.me?.user?.avatarURL({
								format: "png",
								dynamic: true,
								size: 32,
							}),
							"https://kifopl.github.io/kifo-clanker/"
						)
						.setFooter(`Command issued by ${message.author.tag}, sent at: ${date.toUTCString()}`)
					await result.forEach((row) => {
						newEmbed.addField(`${countries.languagesAll[row.language].name}`, `Confidence: ${row.confidence}\n${row.isReliable ? `<:GreenCheck:857976926941478923> Pretty sure!` : `<:RedX:857976926542757910> Not so certain.`}`)
					})
					message.reply({ embeds: [newEmbed] }).catch(() => { })
				} else {
					return message.reply({ embeds: [kifo.embed("Could not detect a language :(", "Error:")] }).catch(() => { })
				}
			})
		}).catch(() => {
			return message.reply({ embeds: [kifo.embed(`Invalid message URL or Id!`)] }).catch(() => { })
		})
	},
};
