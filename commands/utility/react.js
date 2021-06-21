module.exports = {
	name: "react",
	description:
		'This command tells the bot to react to all messages in the channel with specific reactions.\n"!kifo react list" to list channels, where the command is active.',
	usage:
		"!kifo react <on/off> <emote1> <optional_emote2> ... <optional_emoten>",
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	execute(message, args, Discord) {
		const kifo = require("kifo");
		if (message.guild == null)
			return message.reply(kifo.embed(
				"you can only run this command on the server."
			));
		if (!(args[0].toUpperCase() == "ON" || args[0].toUpperCase() == "OFF"))
			return message.reply(kifo.embed(`Usage: ${this.usage}.`));
		if (!message.guild.me.permissionsIn(message.channel).has("ADD_REACTIONS"))
			return message.reply(kifo.embed("I need `ADD_REACTIONS` permissions in this channel to work properly."));
		
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
			if (!args[0]) {
				embedreply
					.setTitle(`Error:`)
					.setDescription(`Usage: ${this.usage}.`);
				return message.reply(embedreply);
			}
			if (args[22]) {
				embedreply
					.setTitle(`Error:`)
					.setDescription(`Too many reactions!`);
				return message.reply(embedreply);
			}
			let params = [option, emotes];
			embedreply.setDescription("It's ON!");
			message.reply(embedreply);
			return params;
		} else {
			let params = [option, 0];
			embedreply.setDescription("It's OFF!");
			message.reply(embedreply);
			return params;
		}
	},
};
