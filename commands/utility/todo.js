const Discord = require("discord.js");
module.exports = {
	name: "todo",
	description: "This command allows you to create a simple todo notes.",
	usage: [
		"`todo <description>` - sends a DM with description (react with any emote to the message to delete it).",
		"`todo <message_url> <optional_description>` - sends a DM with message content, link to the message and optional description.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	async execute(message, args) {
		const kifo = require("kifo");
		if (!args[0]) return message.reply(kifo.embed(`usage: ${this.usage}`));

		const Embed = new Discord.MessageEmbed();
		const Now = new Date(Date.now());

		let isLink = false;
		let msg = null;

		if (args[0].match(kifo.urlRegex())) {
			let linkArr = args[0].split("/");
			let msgID = linkArr[linkArr.length - 1]
			let channelID = linkArr[linkArr.length - 2]
			let guildID = linkArr[linkArr.length - 3]

			msg = await message.client.guilds.resolve(guildID).channels.resolve(channelID).messages.fetch(msgID)
			if (msg != null) isLink = true;
		}

		if (isLink) args.shift();

		Embed.setTitle("A new task awaits!")
			.setAuthor(
				"TODO",
				message.guild?.me?.user?.avatarURL({
					format: "png",
					dynamic: true,
					size: 64,
				}),
				"https://kifopl.github.io/kifo-clanker/"
			)
			.setDescription(
				isLink ? msg.content + `\n==========\n${args.join(" ")}` : args.join(" ")
			)
			.setColor(`a039a0`)
			.setFooter(`Created at: ${Now.toUTCString()}`);
		if (isLink) Embed.addField("Link:", `[Click for original message!](${msg.url})`);
		Embed.addField("Finished?", `React with <a:done:828097348545544202> to mark it as done!`)
		message.author
			.send(Embed)
			.then((message1) => {
				message1.react(`<a:done:828097348545544202>`);
				message1.pin().catch(() => { })
				message.reply(kifo.embed("Knock knock, I just left you a note in DMs!")).catch(() => { })
			})
			.catch();
	},
};
