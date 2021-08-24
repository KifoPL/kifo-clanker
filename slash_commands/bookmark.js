const kifo = require("kifo");
const Discord = require("discord.js");
const fs = require("fs");
const https = require("https");

module.exports = {
	name: "bookmark",
	description:
		"Sends a copy of the message in DM (with attachments) (**DEPRECATED**).",
	options: [
		{
			name: "message",
			type: "STRING",
			description: "ID or URL of the message.",
			required: true,
		},
		{
			name: "pin",
			type: "BOOLEAN",
			description:
				"Whether the message should be pinned. False by default.",
		},
	],
	defaultPermission: true,
	guildonly: true,
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
	let options = itr.options.data;
	let msgResolvable = options.find((o) => o.name === "message").value;
	if (msgResolvable.match(kifo.urlRegex())) {
		msgResolvable = msgResolvable.split("/").pop();
		if (!msgResolvable.match(/\d{16,22}/gm)) {
			return itr.editReply({
				embeds: [
					kifo.embed("Please use **message link** or **message Id**!"),
				],
				ephemeral: true,
			});
		}
	}
	let pin = options.find((o) => o.name === "pin")?.value ?? false;
	let msg = await itr.channel.messages.fetch(msgResolvable);
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
			.addField("Message content:", `${msg.content?.length > 0 ? msg.content : "*No content.*"}`)
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
				if (pin) msgCopy.pin().catch(() => {});
				itr.editReply({
					embeds: [kifo.embed("Saved a copy in DM!\n\n**DEPRECATION WARNING**: This will be removed in a future release, because of context menus. If you're on PC, simply right-click on message, then choose `Apps` > `Save`.")],
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