const Discord = require("discord.js");
const main = require(`../../index.js`);
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
	async execute(message, args) {
		const kifo = require("kifo");
		const ms = require("ms");
		const client = require("../../index.js").client;
		const { con } = require("../../index.js");

		//precheck
		if (!message.guild == null)
			return message
				.reply({ embeds: [kifo.embed(`you can only run this command in a server!`)] })
				.catch(() => {});

		//perms check
		if (
			!message.guild?.me
				.permissionsIn(message.channel)
				.has(Discord.Permissions.FLAGS.MANAGE_CHANNELS)
		) {
			return message.reply({
				embeds: [
				kifo.embed("Missing `MANAGE_CHANNELS` permission!")
				]
			});
		}
		if (
			!message.guild?.me
				.permissionsIn(message.channel)
				.has(Discord.Permissions.FLAGS.ADD_REACTIONS)
		) {
			return message.reply({
				embeds: [
				kifo.embed("Missing `ADD_REACTIONS` permission!")
				]
			});
		}

		if (!args[0]) {
			return message.reply({
				embeds: [
				kifo.embed(`- ${this.usage.join("\n- ")}`, "Usage:")
				]
			});
		}
		if (!args[1]) {
			return message.reply({
				embeds: [
				kifo.embed(
					`Usage: ${this.usage.join("\n")}`,
					"Incorrect syntax!"
				)
				]
			});
		}

		if (isNaN(args[0]))
			return message
				.reply({ embeds: [kifo.embed("Please provide correct amount of winners!")] })
				.catch(() => {});
		if (args[0] < 1)
			return message
				.reply({ embeds: [kifo.embed("Please choose at least one winner!")] })
				.catch(() => {});
		if (Math.floor(args[0]) != args[0])
			return message
				.reply({
					embeds: [
					kifo.embed("Please choose an integer amount of winners!")
					]
				})
				.catch(() => {});
		if (isNaN(ms(args[1])))
			return message
				.reply({ embeds: [kifo.embed("Please provide correct time period!")] })
				.catch(() => {});
		if (ms(args[1]) < 1000 * 60)
			return message
				.reply({
					embeds: [
					kifo.embed(
						"Please set the giveaway to at least 1 minute long."
					)
					]
				})
				.catch(() => {});

		const time = args[1];
		const x = args[0];
		const now = new Date(Date.now());
		const end = new Date(now.getTime() + ms(time));
		const reaction = args[2] ?? "<a:done:828097348545544202>";
		if (
			client.emojis.resolveIdentifier(reaction) == null &&
			!reaction.match(kifo.emojiRegex())
		) {
			return message.reply({ embeds: [kifo.embed("Incorrect reaction!")] });
		}

		message.channel
			.send({
				content:
				`Ends at: <t:${Math.floor(
					end.getTime() / 1000
				)}>, <t:${Math.floor(end.getTime() / 1000)}:R>`,
				embeds:
					[kifo.embed(
					`React with ${reaction} to enter! The ${x} winner${
						x > 1 ? "s" : ""
					} will be chosen at ${end.toUTCString()}.`,
					"GIVEAWAY!"
					)]
			})
			.then((msg) => {
				message.delete().catch(() => { })
				msg.react(reaction)
					.then((reaction1) => {
						con.query(
							"INSERT INTO giveaway (MessageId , ChannelId , GuildId , UserId, Winners , EndTime , Reaction) VALUES (?, ?, ?, ?, ?, ?, ?);",
							[
								msg.id,
								msg.channel.id,
								msg.guild.id,
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
					.catch((err) => {
						main.log(err);
					});
			});
	},
};
