module.exports = {
	name: "superslow",
	description: `Enable Super slow-mode (longer than 6 hours) for channels where you need it.\n"!kifo superslow list" to list channels, where the command is active.`,
	usage: `!kifo superslow <time_period> [0 to turn it off]`,
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	execute(message, args) {
		//This is for timestamps
		const ms = require(`ms`);
		let shortest = ms("6h");
		let longest = ms("1y");
		if (!args[0]) return message.reply(`Usage: ${this.usage}`);
		if (message.guild == null)
			return message.reply(
				"you can only run this command on the server."
			);
		if (!message.guild.me.permissionsIn(message.channel).has("MANAGE_CHANNELS"))
		return message.reply("This command need `MANAGE_CHANNELS` permissions to work properly.");

		if (!message.guild.me.permissionsIn(message.channel).has("MANAGE_MESSAGES"))
		return message.reply("This command need `MANAGE_MESSAGES` permissions to work properly.");
			
		if (isNaN(ms(args[0])))
			return message.reply(
				"incorrect time period. Please specify correct time period (Set to `0s` to turn it off)."
			);
		if (ms(args[0]) < shortest && ms(args[0]) != 0)
			return message.reply(
				"just use normal Discord slow-mode, no need to waste my bot's resources."
			);
		if (ms(args[0]) > longest)
			return message.reply(
				"incorrect amount of time. For the command to work, please input period of time that is between " +
					ms(shortest, { long: true }) +
					" and " +
					ms(longest, { long: true }) +
					"."
			);
		let isOff = false;
		if (ms(args[0]) == 0) isOff = true;
		let params = [isOff, ms(args[0])];
		return params;
		//for every channel it works it saves userid - timestamp pair
		//Make sure you don't add superslowmode to the channel it already exists.
		//Can't superslowmode admins.
	},
};
