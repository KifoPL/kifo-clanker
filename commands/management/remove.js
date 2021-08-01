const Discord = require("discord.js");
module.exports = {
	name: "remove",
	description: "This command allows you to (temporarily) remove user role.",
	usage: [
		"`remove` - Informs you of syntax.",
		"`remove <user> <role>` - permanently removes role from user.",
		"`remove <user> <role> <time_period>` - removes role from user, and re-adds it after given time period.",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES", "MANAGE_ROLES"],
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
		if (!message.guild?.me.permissions.has(Discord.Permissions.FLAGS.MANAGE_ROLES)) {
			return message
				.reply({ embeds: [kifo.embed("I don't have `MANAGE_ROLES` permission!")] })
				.catch(() => {});
		}
		if (!message.member.permissions.has(Discord.Permissions.FLAGS.MANAGE_ROLES)) {
			return message
				.reply({ embeds: [kifo.embed("You don't have `MANAGE_ROLES` permission!")] })
				.catch(() => {});
		}

		if (!args[0]) {
			return message
				.reply({ embeds: [kifo.embed(`- ${this.usage.join("\n- ")}`, "Usage:")] })
				.catch(() => {});
		}
		if (!args[1]) {
			return message
				.reply({
					embeds: [
					kifo.embed(
						`Usage: ${this.usage.join("\n")}`,
						"Incorrect syntax!"
					)
					]
				})
				.catch(() => {});
		}

		let time = args[2];

		let member = {};
		let role = {};

		//ARGS CHECK
		if (message.guild.members.resolve(args[0]) == null)
			if (message.mentions.members.first() == null)
				return message
					.reply({ embeds: [kifo.embed("Incorrect user!")] })
					.catch(() => {});
			else member = message.mentions.members.first();
		else member = message.guild.members.resolve(args[0]);

		if (message.guild.roles.resolve(args[1]) == null)
			if (message.mentions.roles.first() == null)
				return message.reply({ embeds: [kifo.embed("Incorrect role!")] });
			else role = message.mentions.roles.first();
		else role = message.guild.roles.resolve(args[1]);

		//LOGIC CHECK
		if (
			member.roles.highest.rawPosition >=
			message.member.roles.highest.rawPosition
		) {
			return message
				.reply({ embeds: [kifo.embed(`You can't remove <@!${member.id}>'s role!`)] })
				.catch(() => {});
		}
		if (
			member.roles.highest.rawPosition >=
			message.guild.me.roles.highest.rawPosition
		) {
			return message
				.reply({ embeds: [kifo.embed(`I can't remove <@!${member.id}>'s role!`)] })
				.catch(() => {});
		}
		if (member == message.member && role == member.roles.highest)
			return message
				.reply({ embeds: [kifo.embed(`You can't remove your highest role!`)] })
				.catch(() => {});

		const now = new Date(Date.now());

		if (args[3] != null) {
			return message
				.reply({ embeds: [kifo.embed("Too many arguments!")] })
				.catch(() => {});
		}

		if (args[2] != null) {
			if (isNaN(ms(time))) {
				return message
					.reply({ embeds: [kifo.embed("Incorrect time period!")] })
					.catch(() => {});
			}
			if (ms(time) < 1000 * 60) {
				return message
					.reply({
						embeds: [
						kifo.embed(
							"Please set the time period to at least a minute!"
						)
						]
					})
					.catch(() => {});
			}
			const end = new Date(now.getTime() + ms(time));
			member.roles
				.remove(
					role.id,
					`Issued command \`remove\` by @${message.author.tag}`
				)
				.then(() => {
					message.channel
						.send({
							content:
							`I'll re-add the role at: <t:${Math.floor(
								end.getTime() / 1000
							)}>, <t:${Math.floor(end.getTime() / 1000)}:R>`,
							embeds: [kifo.embed(
								`Issued by: <@!${message.member.id}>\nRole removed: <@&${role.id}>\nFrom: <@!${member.id}>`,
								`Role remove command`
							)]
						})
						.catch(() => {});
					con.query(
						"INSERT INTO role_remove (UserId , RoleId , PerpetratorId , ChannelId , GuildId, EndTime) VALUES (?, ?, ?, ?, ?, ?)",
						[
							member.id,
							role.id,
							message.author.id,
							message.channel.id,
							message.guild.id,
							end,
						],
						function (err) {
							if (err) throw err;
						}
					);
				})
				.catch((err) => {
					message.channel
						.send({ embeds: [kifo.embed(err.message, "Could not remove role!")] })
						.catch(() => {});
				});
		} else {
			member.roles
				.remove(
					role.id,
					`Issued command \`remove\` by @${message.author.tag}`
				)
				.then(() => {
					message.channel
						.send({
							embeds: [
							kifo.embed(
								`Issued by: <@!${message.member.id}>\nRole removed: <@&${role.id}>\nFrom: <@!${member.id}>`,
								`Role remove command`
							)
							]
						})
						.catch(() => {});
				})
				.catch((err) => {
					message.channel
						.send({ embeds: [kifo.embed(err.message, "Could not remove role!")] })
						.catch(() => {});
				});
		}
	},
};
