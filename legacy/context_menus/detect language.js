const Discord = require("discord.js");
const api = require("detectlanguage");
const kifo = require("kifo");
const countries = require("countries-list");
module.exports = {
	name: "detect language",
	description: "This command allows you to detect message language.",
	guildonly: false,
	type: "MESSAGE",
	perms: ["USE_APPLICATION_COMMANDS"],
	async execute(itr) {
		await itr.deferReply({ ephemeral: true });
		let msg = itr.options.getMessage("message");

		var dtlang = new api(process.env.LANGUAGE_DETECT_KEY);
		dtlang.detect(msg.content).then(async (result) => {
			if (result.length > 0) {
				const date = new Date(Date.now());
				let newEmbed = kifo
					.embed("", "Detected language:")
					.setTitle("Detected language:")
					.setColor("a039a0")
					.setFooter(
						`Command issued by ${
							itr.user.tag
						}, sent at: ${date.toUTCString()}`
					);
				await result.forEach((row) => {
					newEmbed.addField(
						`${countries.languagesAll[row.language].name}`,
						`Confidence: ${row.confidence}\n${
							row.isReliable
								? `<:GreenCheck:857976926941478923> Pretty sure!`
								: `<:RedX:857976926542757910> Not so certain.`
						}`
					);
				});
				itr.editReply({ embeds: [newEmbed] }).catch(() => {});
			} else {
				return itr
					.editReply({
						embeds: [
							kifo.embed(
								"Could not detect a language :(",
								"Error:"
							),
						],
					})
					.catch(() => {});
			}
		});
	},
};
