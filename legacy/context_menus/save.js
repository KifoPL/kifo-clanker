const kifo = require("kifo");
const Discord = require("discord.js");
const fs = require("fs");
const https = require("https");

module.exports = {
	name: "save",
	description: "Sends a copy of the message in DM (with attachments).",
	type: "MESSAGE",
	guildonly: false,
	category: "UTILITY",
	perms: ["USE_APPLICATION_COMMANDS"],

	//itr = interaction
	execute: execute,

	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};

/**
 *
 * @param {*} url
 * @returns promise
 */
async function downloadAttachment(url) {
	return new Promise((resolve, reject) => {
		https.get(url, (result) => {
			const filepath = fs.createWriteStream(`./${url.split("/").pop()}`);
			result.pipe(filepath);
			filepath.on("finish", () => {
				filepath.close();
				resolve();
			});
			filepath.on("error", (err) => reject);
		});
	});
}

async function execute(itr) {
	await itr.deferReply({ ephemeral: true });
	let msg = itr.options.getMessage('message');
	let urlArr = [];
	msg.attachments.each((att) => urlArr.push(att.url));
	let attNames = urlArr.map((a) => a.split("/").pop());
	let attPaths = attNames.map((a) => `./${a}`);
	let promises = [];
	urlArr.forEach((row) => promises.push(downloadAttachment(row)));
	Promise.all(promises).then(() => {
		let copyEmbed = kifo.embed(
			``,
			`BOOKMARK - ${msg.channel.name.replace("-", () => " ")}, ${
				msg.guild.name
			}`
		);
		copyEmbed
			.setAuthor(
				`${msg.author.tag}, Id: ${msg.member.id}`,
				msg.author.avatarURL({ dynamic: true })
			)
			.setURL(msg.url)
			.addField("Message content:", `${msg.content?.length > 0 ? msg.content.replace(/<@&\d{16,20}>/gm, (match) => 
				`@${msg.guild.roles.resolve(match.slice(3,-1)).name}`
			) : "*No content.*"}`)
			.addField(
				"Don't need this anymore?",
				"React with <:RedX:857976926542757910> to delete this bookmark."
			);
		itr.member
			.send({
				embeds: [copyEmbed],
				files: attPaths,
			})
			.then((msgCopy) => {
				msgCopy.react("<:RedX:857976926542757910>").catch(() => {});
				itr.editReply({
					embeds: [kifo.embed("Saved a copy in DM!")],
					ephemeral: true,
				});
			})
			.catch(() => {})
			.finally(() => {
				attPaths.forEach((attPath) => {
					fs.unlink(attPath, (err) => {
						if (err) main.log(err);
					});
				});
			});
	});
}
