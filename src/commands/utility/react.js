const Discord = require("discord.js");
module.exports = {
	name: "react",
	description:
		"This command tells the bot to react to all messages in the channel with specific reactions.",
	usage: [
		"`react on <emote1> <optional_emote2> ... <optional_emoten>` - turns on react command in this channel.",
		"`react off` - turns off react command in this channel",
		"`react` - checks if there is react module online.",
		"`react list` - lists channels in which the command is active.",
	],
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	execute(message, args) {
		const kifo = require("kifo");
		const client = require("../../index.js").client;
		if (message.guild == null)
			return message.reply({
				embeds: [
				kifo.embed("you can only run this command on the server.")
				]
			});
		if (!(args[0].toUpperCase() == "ON" || args[0].toUpperCase() == "OFF"))
			return message.reply({
				embeds: [
				kifo.embed(`Usage: ${this.usage.join("\n")}.`)
				]
			});
		if (
			!message.guild.me
				.permissionsIn(message.channel)
				.has(Discord.Permissions.FLAGS.ADD_REACTIONS)
		)
			return message.reply({
				embeds: [
				kifo.embed(
					"I need `ADD_REACTIONS` permissions in this channel to work properly."
				)
				]
			});

		let option = args[0].toUpperCase();
		args.shift();
		let emotes = args;

		const embedreply = new Discord.MessageEmbed();
		embedreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(
				`Command "${this.name.toUpperCase()}" issued by ${
					message.author.tag
				}`
			);

		if (option == "ON") {
			let stop = false;
			if (!args[0]) {
				embedreply
					.setTitle(`Error:`)
					.setDescription(`Usage: ${this.usage.join("\n")}.`);
				return message.reply({ embeds: [embedreply] });
			}
			if (args[22]) {
				embedreply
					.setTitle(`Error:`)
					.setDescription(`Too many reactions!`);
				return message.reply({ embeds: [embedreply] });
			}
			args.forEach((arg) => {
				if (
					client.emojis.resolve(kifo.emojiTrim(arg)) == null &&
					!arg.match(kifo.emojiRegex())
				) {
					stop = true;
					return message
						.reply({ embeds: [kifo.embed(`${arg} is an incorrect reaction!`)] })
						.catch(() => {});
				}
			});
			if (stop) return;
			let params = [option, emotes];
			embedreply.setDescription("It's ON!");
			message.reply({ embeds: [embedreply] });
			return params;
		} else {
			let params = [option, 0];
			embedreply.setDescription("It's OFF!");
			message.reply({ embeds: [embedreply] });
			return params;
		}
	},
};
