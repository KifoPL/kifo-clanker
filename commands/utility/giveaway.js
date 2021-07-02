module.exports = {
	name: "giveaway",
	description:
		"This command allows you to set up a timeout, after which random winners who reacted will be selected.",
	usage: [
		"`giveaway` - Informs you of syntax.",
		"`giveaway <x> <time_period>` - sets up a message with default reaction as <a:done:828097348545544202> that'll choose `x` random users after `time_period`.",
		"`giveaway <x> <time_period> <reaction>` - sets up a message with `reaction`, that'll choose `x` random users after `time_period`.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS", "ADD_REACTIONS"],
	async execute(message, args, Discord, prefix) {
		const kifo = require("kifo");
		const ms = require("ms");
		const client = require("../../index.js").client;
		const { con } = require("../../index.js");

		//perms check
		if (
			!message.guild?.me
				.permissionsIn(message.channel)
				.has("MANAGE_CHANNELS")
		) {
			return message.reply(
				kifo.embed("Missing `MANAGE_CHANNELS` permission!")
			);
		}
		if (
			!message.guild?.me
				.permissionsIn(message.channel)
				.has("ADD_REACTIONS")
		) {
			return message.reply(
				kifo.embed("Missing `ADD_REACTIONS` permission!")
			);
		}

		if (!args[0]) {
			return message.reply(
				kifo.embed(`- ${this.usage.join("\n- ")}`, "Usage:")
			);
		}
		if (!args[1]) {
			return message.reply(
				kifo.embed(
					`Usage: ${this.usage.join("\n")}`,
					"Incorrect syntax!"
				)
			);
		}

		const time = args[1];
		const x = args[0];
		const now = new Date(Date.now());
		const end = new Date(now.getTime() + ms(time));
		const reaction = args[2] ?? "<a:done:828097348545544202>";
		if (
			client.emojis.resolveIdentifier(reaction) == null &&
			!reaction.match(kifo.emojiRegex())
		) {
			return message.reply(kifo.embed("Incorrect reaction!"));
		}

		message.channel
			.send(`Ends at: <t:${Math.floor(end.getTime()/1000)}>, <t:${Math.floor(end.getTime()/1000)}:R>`,
				kifo.embed(
					`React with ${reaction} to enter! The giveaway ends at ${end.toUTCString()}.`
				)
			)
			.then((message) => {
				message
					.react(reaction)
					.then((reaction1) => {
						con.query(
							"INSERT INTO giveaway (MessageId , ChannelId , GuildId , UserId, Winners , EndTime , Reaction) VALUES (?, ?, ?, ?, ?, ?, ?);",
							[
								message.id,
								message.channel.id,
								message.guild.id,
								message.author.id,
								x,
								end,
								reaction1.emoji.id,
							],
							function (err) {
								if (err) throw err;
							}
						);
					})
					.catch((err) => console.log(err));
			});
	},
};
