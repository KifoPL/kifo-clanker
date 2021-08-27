const Discord = require("discord.js");
module.exports = {
	name: "superslow",
	description: `Enable Super slow-mode (longer than 6 hours) for channels where you need it.`,
	usage: [
		"`superslow <time>` - turns on superslow command in this channel (setting time to 0s will turn off superslow module). ",
		"`superslow` checks if there is a superslow module online.",
		"`superslow list` lists channels in which the command is active.",
	],
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	execute(message, args) {
		//This is for timestamps
		const ms = require(`ms`);
		const kifo = require("kifo");
		let shortest = ms("6h");
		let longest = ms("1y");
		if (!args[0])
			return message.reply({
				embeds: [kifo.embed(`Usage: ${this.usage.join("\n")}`)],
			});
		if (message.guild == null)
			return message.reply({
				embeds: [
					kifo.embed("you can only run this command on the server."),
				],
			});
		if (
			!message.guild.me
				.permissionsIn(message.channel)
				.has(Discord.Permissions.FLAGS.MANAGE_CHANNELS)
		)
			return message.reply({
				embeds: [
					kifo.embed(
						"This command need `MANAGE_CHANNELS` permissions to work properly."
					),
				],
			});

		if (
			!message.guild.me
				.permissionsIn(message.channel)
				.has(Discord.Permissions.FLAGS.MANAGE_MESSAGES)
		)
			return message.reply({
				embeds: [
					kifo.embed(
						"This command need `MANAGE_MESSAGES` permissions to work properly."
					),
				],
			});

		if (isNaN(ms(args[0])))
			return message.reply({
				embeds: [
					kifo.embed(
						"incorrect time period. Please specify correct time period (Set to `0s` to turn it off)."
					),
				],
			});
		if (ms(args[0]) < shortest && ms(args[0]) != 0)
			return message.reply({
				embeds: [
					kifo.embed(
						"just use normal Discord slow-mode, no need to waste my bot's resources."
					),
				],
			});
		if (ms(args[0]) > longest)
			return message.reply({
				embeds: [
					kifo.embed(
						"incorrect amount of time. For the command to work, please input period of time that is between " +
							ms(shortest, { long: true }) +
							" and " +
							ms(longest, { long: true }) +
							"."
					),
				],
			});
		let isOff = false;
		if (ms(args[0]) == 0) isOff = true;
		let params = [isOff, ms(args[0])];
		return params;
		//for every channel it works it saves userid - timestamp pair
		//Make sure you don't add superslowmode to the channel it already exists.
		//Can't superslowmode admins.
	},
};
