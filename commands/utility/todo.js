module.exports = {
	name: "todo",
	description: "This command allows you to create a simple todo notes.",
	usage: ["`todo <description>` - sends a DM with description (react with any emote to the message to delete it)."],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, Discord) {
		if (!args[0]) return message.reply(kifo.embed(`usage: ${this.usage}`));

		const Embed = new Discord.MessageEmbed();
		const Now = new Date(Date.now());

		Embed.setTitle(args.join(" "))
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
				`React with <a:done:828097348545544202> to mark it as done!`
			)
			.setColor(`a039a0`)
			.setFooter(`Created at: ${Now.toUTCString()}`);
		message.author
			.send(Embed)
			.then((message1) => {
				message1.react(`<a:done:828097348545544202>`);
			})
			.catch();
	},
};
