const Discord = require("discord.js");
const { MessageMentions } = require("discord.js");

const kifo = require("kifo");
const main = require("../../index.js");
const fs = require("fs");
const ms = require("ms");
const now = new Date(Date.now());

module.exports = {
	name: "menu",
	description:
		"This powerful command allows you to create role menu or channel perms menu with optional timeout",
	usage: [
		"`menu` - DMs you with channel aliases and syntax of the command.",
		"`menu list` - lists active menus in the server (requires `MANAGE_GUILD`)",
		"`menu perm <perm_alias> <channel>` - creates a menu, that when user reacts, they get `perm_alias` in `channel`.",
		"`menu perm <perm_alias> <channel> <time_period>` - creates a menu, that when user reacts, they get `perm_alias` in `channel`. Everyone's perms will be reverted `time_period` after menu is created.",
		"`menu role <role>` - creates a menu, that when user reacts, they get `role`.",
		"`menu role <role> <time_period>` - creates a menu, that when user reacts, they get `role`. Everyone's role will be reverted `time_period` after menu is created.",
		"`menu revert <message_url>` - removes `role` / `channel perm` from everyone who reacted to menu.",
	],
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	/**
	 *
	 * @param {*} message the message that executed the commandList
	 * @param {*} menu the menu that needs to be reverted
	 * @param {boolean} isPerm whether you want to revert perms, or menu
	 * @param {*} obj channel for perm menu, role for role menu
	 * @param {string} perm perm name for perm menus, null otherwise
	 */
	revert: revert,
	execute: execute,
};

async function revert(message, menu, isPerm, obj, permName = null) {
	//obj is either channel or role
	if (isPerm) {
		let reaction = menu.reactions.resolve("857976926941478923");
		await reaction.users.fetch();
		await reaction.users.cache
			.filter((user) => !user.bot)
			.each((user) => {
				//change perm to neutral
				let perm = obj.permissionOverwrites.get(user.id);
				if (perm != undefined) {
					perm.update({
						[permName]: null,
					})
						.then(() => {
							user.send(
								kifo.embed(
									`Set <:GreySlash:857976926445502505> \`${menu.PermName}\` in <#${menu.DestinationChannelId}>!`
								)
							).catch(() => {});
						})
						.catch((err) => {
							message
								.reply(
									kifo.embed(
										`Couldn't change <@!${user.id}> ${PermName} to <:GreySlash:857976926445502505>!`
									)
								)
								.catch(() => {});
							main.log(err);
						});
				}
			});
		message.author.send(kifo.embed(`Removed [perm menu](${message.url})!`));
		main.con.query(
			"DELETE FROM menu_perms WHERE MessageId = ?",
			[menu.id],
			function (err) {
				if (err) throw err;
			}
		);
		main.menus.delete(menu.id);
	} else {
		let reaction = menu.reactions.resolve("823658022948700240");
		await reaction.users.fetch();
		await reaction.users.cache
			.filter((user) => !user.bot)
			.each((user) => {
				let member = message.guild.members.resolve(user.id);
				if (member != undefined) {
					member.roles
						.remove(obj)
						.then(() => {
							member
								.send(
									kifo.embed(
										`Removed ${obj.name} role! (ID: ${menu.RoleId})`
									)
								)
								.catch(() => {});
						})
						.catch((err) => {
							message
								.reply(
									kifo.embed(
										`Could not remove <@!${member.id}>'s role <@&${obj.id}>!`
									)
								)
								.catch(() => {});
							main.log(err);
						});
				}
			});
		message.author.send(kifo.embed(`Removed [role menu](${message.url})!`));
		main.con.query(
			"DELETE FROM menu_roles WHERE MessageId = ?",
			[menu.id],
			function (err) {
				if (err) throw err;
			}
		);
		main.menus.delete(menu.id);
	}
	menu.delete({ timeout: 2000, reason: "Reverted Menu!" }).catch(() => {
		message
			.reply(
				kifo.embed(
					`Could not delete [${isPerm ? "Perm Menu" : "Role Menu"}](${
						menu.url
					})!\nThe message may be too old to remove it automatically, you need to do it manually.`
				)
			)
			.catch(() => {});
	});
}
async function execute(message, args, prefix) {
	const { con } = require(`../../index.js`);
	//menu
	if (!args[0]) {
		const newEmbed = new Discord.MessageEmbed()
			.setColor("a039a0")
			.setTitle(`__List of perms with their aliases:__`)
			.setDescription(`Usage:\n- ${this.usage.join("\n- ")}`)
			.setAuthor(
				"Kifo Clanker™, by KifoPL#3358",
				message.guild.me?.user?.avatarURL({
					format: "png",
					dynamic: true,
					size: 64,
				}),
				"https://kifopl.github.io/kifo-clanker/"
			)
			.setFooter(
				`Issued by ${message.member.displayName} - ${
					message.member.id
				} at ${now.toUTCString()}.`
			);
		//write all aliases of all text channel perms.
		kifo.channelPerms.forEach(async (perm) => {
			newEmbed.addField(
				`${perm.Id}. ${perm.name}`,
				`${perm.aliases.join(", ")}`,
				false
			);
		});
		message.author
			.send(newEmbed)
			.then(() => message.reply(kifo.embed("Check your DMs!")))
			.catch(() => {});
		return;
	}
	if (!args[1]) {
		if (args[0].toLowerCase() === "list") {
			if (!message.member.hasPermission("MANAGE_GUILD")) {
				if (
					!message.member
						.permissionsIn(message.channel)
						.has("MANAGE_CHANNELS")
				) {
					return message
						.reply(
							kifo.embed(
								"You need `MANAGE_CHANNELS` permissions to see menus in this channel, or `MANAGE_GUILD` to see menus in entire server!"
							)
						)
						.catch(() => {});
				}
				//list perm menus from this channel
				con.query(
					"SELECT * FROM menu_perms mp WHERE mp.ChannelId = ? AND mp.Guildid = ? ORDER BY mp.StartDate DESC LIMIT 10",
					[message.channel.id, message.guild.id],
					function (err, result) {
						if (err) throw err;
						if (result.length > 0) {
							const newEmbed = new Discord.MessageEmbed()
								.setTitle("__Perm Menus list:__")
								.setColor("a039a0")
								.setDescription(
									`${result.length} menus (showing max 10 newest):`
								)
								.setAuthor(
									"Kifo Clanker™, by KifoPL#3358",
									message.guild.me?.user?.avatarURL({
										format: "png",
										dynamic: true,
										size: 64,
									}),
									"https://kifopl.github.io/kifo-clanker/"
								)
								.setFooter(
									`Issued by ${
										message.member.displayName
									} - ${
										message.member.id
									} at ${now.toUTCString()}.`
								);
							result.forEach((row) => {
								newEmbed.addField(
									`${row.PermName}`,
									`${
										row.EndDate != null
											? `Reverts at <t:${Math.floor(
													row.EndDate.getTime() / 1000
											  )}>`
											: `No End Date.`
									}, [menu](${
										message.channel.messages.resolve(
											row.MessageId
										).url
									})`
								);
							});
							return message.reply(newEmbed).catch((err) => {
								main.log(err);
							});
						}
						return message.reply(kifo.embed("No Perm Menus set!"));
					}
				);
				//list role menus from this channel
				con.query(
					"SELECT * FROM menu_roles mr WHERE mr.GuildId = ? AND mr.ChannelId = ? ORDER BY mr.StartDate DESC LIMIT 10",
					[message.guild.id, message.channel.id],
					function (err, result) {
						if (err) throw err;
						if (result.length > 0) {
							const newEmbed = new Discord.MessageEmbed()
								.setTitle("__Role Menus list:__")
								.setColor("a039a0")
								.setDescription(
									`${result.length} menus (showing max 10 newest):`
								)
								.setAuthor(
									"Kifo Clanker™, by KifoPL#3358",
									message.guild.me?.user?.avatarURL({
										format: "png",
										dynamic: true,
										size: 64,
									}),
									"https://kifopl.github.io/kifo-clanker/"
								)
								.setFooter(
									`Issued by ${
										message.member.displayName
									} - ${
										message.member.id
									} at ${now.toUTCString()}.`
								);
							result.forEach((row) => {
								newEmbed.addField(
									`${row.RoleId}`,
									`<@&${row.RoleId}>, ${
										row.EndDate != null
											? `Reverts at <t:${Math.floor(
													row.EndDate.getTime() / 1000
											  )}>`
											: `No End Date.`
									}, [menu](${
										message.channel.messages.resolve(
											row.MessageId
										).url
									})`
								);
							});
							return message.reply(newEmbed).catch((err) => {
								main.log(err);
							});
						}
						return message
							.reply(kifo.embed("No Role Menus set!"))
							.catch((err) => {
								main.log(err);
							});
					}
				);
				return;
			}
			//list perm menus from server
			con.query(
				"SELECT * FROM menu_perms mp WHERE mp.GuildId = ? ORDER BY mp.StartDate DESC LIMIT 10",
				[message.guild.id],
				function (err, result) {
					if (err) throw err;
					if (result.length > 0) {
						const newEmbed = new Discord.MessageEmbed()
							.setTitle("__Perms Menu list:__")
							.setColor("a039a0")
							.setDescription(
								`${result.length} menus (showing max 10 newest):`
							)
							.setAuthor(
								"Kifo Clanker™, by KifoPL#3358",
								message.guild.me?.user?.avatarURL({
									format: "png",
									dynamic: true,
									size: 64,
								}),
								"https://kifopl.github.io/kifo-clanker/"
							)
							.setFooter(
								`Issued by ${message.member.displayName} - ${
									message.member.id
								} at ${now.toUTCString()}.`
							);
						result.forEach((row) => {
							newEmbed.addField(
								`${
									message.guild.channels.resolve(
										row.ChannelId
									).name
								} ${row.PermName}`,
								`<#${row.ChannelId}> ${row.PermName}, ${
									row.EndDate != null
										? `reverts at <t:${Math.floor(
												row.EndDate.getTime() / 1000
										  )}>`
										: `no End Date.`
								}, [menu](${
									message.guild.channels
										.resolve(row.ChannelId)
										.messages.resolve(row.MessageId).url
								})`
							);
						});
						return message.reply(newEmbed).catch((err) => {
							main.log(err);
						});
					}
					return message
						.reply(kifo.embed("No Perm Menus set!"))
						.catch((err) => {
							main.log(err);
						});
				}
			);
			//list role menus from server
			con.query(
				"SELECT * FROM menu_roles mr WHERE mr.GuildId = ? ORDER BY mr.StartDate DESC LIMIT 10",
				[message.guild.id],
				function (err, result) {
					if (err) throw err;
					if (result.length > 0) {
						const newEmbed = new Discord.MessageEmbed()
							.setTitle("__Role Menus list:__")
							.setColor("a039a0")
							.setDescription(
								`${result.length} menus (showing max 10 newest):`
							)
							.setAuthor(
								"Kifo Clanker™, by KifoPL#3358",
								message.guild.me?.user?.avatarURL({
									format: "png",
									dynamic: true,
									size: 64,
								}),
								"https://kifopl.github.io/kifo-clanker/"
							)
							.setFooter(
								`Issued by ${message.member.displayName} - ${
									message.member.id
								} at ${now.toUTCString()}.`
							);
						result.forEach((row) => {
							newEmbed.addField(
								`${
									message.guild.channels.resolve(
										row.ChannelId
									).name
								}, ${
									message.guild.roles.resolve(row.RoleId).name
								}`,
								`<#${row.ChannelId}> <@&${row.RoleId}>, ${
									row.EndDate != null
										? `reverts at <t:${Math.floor(
												row.EndDate.getTime() / 1000
										  )}>`
										: `no End Date.`
								}, [menu](${
									message.guild.channels
										.resolve(row.ChannelId)
										.messages.resolve(row.MessageId).url
								})`
							);
						});
						return message.reply(newEmbed).catch((err) => {
							main.log(err);
						});
					}
					return message
						.reply(kifo.embed("No Role Menus set!"))
						.catch((err) => {
							main.log(err);
						});
				}
			);
			return;
		} else
			return message.reply(
				kifo.embed(
					`Invalid syntax. Usage:\n- ${this.usage.join("\n- ")}`
				)
			);
	} else {
		//PERM CHECK
		if (
			!message.member
				.permissionsIn(message.channel)
				.has("MANAGE_CHANNELS")
		)
			return message.reply(
				kifo.embed("You don't have `MANAGE_CHANNELS` permission!")
			);

		if (
			!message.guild.me
				.permissionsIn(message.channel)
				.has("MANAGE_CHANNELS")
		)
			return message.reply(
				kifo.embed("I don't have `MANAGE_CHANNELS` permission!")
			);

		if (
			!message.guild.me
				.permissionsIn(message.channel)
				.has("ADD_REACTIONS")
		)
			return message.reply(
				kifo.embed("I don't have `ADD_REACTIONS` permission!")
			);

		let now = new Date(Date.now());
		//!kifo menu role
		if (args[0].toLowerCase() === "role") {
			if (!message.member.permissions.has("MANAGE_ROLES"))
				return message.reply(
					kifo.embed("You don't have `MANAGE_ROLES` permission!")
				);

			if (!message.guild.me.permissions.has("MANAGE_ROLES"))
				return message.reply(
					kifo.embed("I don't have `MANAGE_ROLES` permission!")
				);
			let time = null;
			let role = undefined;
			let roleResolvable = args[1];
			if (roleResolvable.match(MessageMentions.ROLES_PATTERN)) {
				role = message.guild.roles.resolve(roleResolvable.slice(3, -1));
			} else {
				role = message.guild.roles.resolve(roleResolvable);
			}
			if (role == undefined) {
				message.reply(kifo.embed("Invalid role!")).catch((err) => {
					main.log(err);
				});
			}
			//!kifo menu role <role> <time_period>
			if (args[2] != undefined) {
				time = ms(args[2]);
				if (isNaN(time)) {
					return message
						.reply(kifo.embed(`Incorrect syntax!`))
						.catch(() => {});
				}
				if (time < 1000 * 60 || time > ms("1y"))
					return message.reply(
						kifo.embed(
							"Invalid time period! Set it to between 1 minute and 1 year."
						)
					);
			}
			const newEmbed = new Discord.MessageEmbed()
				.setTitle("__Role Menu:__")
				.setColor("a039a0")
				.setDescription(
					`React with <:role:823658022948700240> to get <@&${
						role.id
					}>!${
						time != null
							? `\nYour role will be removed at <t:${Math.floor(
									(now.getTime() + time) / 1000
							  )}>, <t:${Math.floor(
									(now.getTime() + time) / 1000
							  )}:R>`
							: ""
					}`
				)
				.setAuthor(
					"Powered by Kifo Clanker™",
					message.guild.me?.user?.avatarURL({
						format: "png",
						dynamic: true,
						size: 64,
					}),
					"https://kifopl.github.io/kifo-clanker/"
				)
				.setFooter(
					`Issued by ${message.member.displayName} - ${
						message.member.id
					} at ${now.toUTCString()}.`
				);

			message
				.reply(newEmbed)
				.then((cbmsg) => {
					con.query(
						"INSERT INTO menu_roles (GuildId , ChannelId , CmdMsgId, CmdChId, MessageId , RoleId , EndDate , StartDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
						[
							cbmsg.guild.id,
							cbmsg.channel.id,
							message.id,
							message.channel.id,
							cbmsg.id,
							role.id,
							time != null
								? new Date(now.getTime() + time)
								: null,
							cbmsg.createdAt,
						],
						function (err) {
							if (err) throw err;
						}
					);
					main.menus.set(cbmsg.id, {
						MessageId: cbmsg.id,
						ChannelId: cbmsg.channel.id,
						GuildId: cbmsg.guild.id,
						isPerm: false,
						RoleId: role.id,
					});
					cbmsg.react("<:role:823658022948700240>").catch((err) => {
						main.log(err);
					});
				})
				.catch((err) => {
					message
						.reply(kifo.embed(err, "Unable to create role menu!"))
						.catch((err) => {
							main.log(err);
						});
					main.log(err);
				});
		}
		//!kifo menu perms perm channel
		else if (args[0].toLowerCase() == "perm") {
			let time = null;
			let alias = args[1].toLowerCase();
			let channel = null;
			let channelResolvable = args[2];
			if (channelResolvable == undefined)
				return message
					.reply(kifo.embed("Invalid syntax!"))
					.catch(() => {});
			if (channelResolvable.match(MessageMentions.CHANNELS_PATTERN)) {
				channel = message.guild.channels.resolve(
					channelResolvable.slice(2, -1)
				);
			} else channel = message.guild.channels.resolve(channelResolvable);
			if (channel == null) {
				return message
					.reply(kifo.embed("Invalid channel!"))
					.catch(() => {});
			}
			//PERM CHECK
			if (!message.member.permissionsIn(channel).has("MANAGE_CHANNELS"))
				return message.reply(
					kifo.embed(
						`You don't have \`MANAGE_CHANNELS\` permission in <#${channel.id}>!`
					)
				);

			if (!message.guild.me.permissionsIn(channel).has("MANAGE_CHANNELS"))
				return message.reply(
					kifo.embed(
						`I don't have \`MANAGE_CHANNELS\` permission in <#${channel.id}>!`
					)
				);
			let perm = kifo.channelPerms.find(
				(c) =>
					c.aliases.includes(alias) ||
					c.name.toLowerCase() == alias ||
					c.Id == alias
			);

			if (perm == undefined) {
				return message
					.reply(kifo.embed("Invalid Perm!"))
					.catch(() => {});
			}
			//!kifo menu perms perm channel time_period
			if (args[3] != undefined) {
				time = ms(args[3]);
				if (isNaN(time)) {
					return message
						.reply(kifo.embed(`Incorrect syntax!`))
						.catch(() => {});
				}
				if (time < 1000 * 60 || time > ms("1y"))
					return message.reply(
						kifo.embed(
							"Invalid time period! Set it to between 1 minute and 1 year."
						)
					);
			}
			const newEmbed = new Discord.MessageEmbed()
				.setTitle("__Perm Menu:__")
				.setColor("a039a0")
				.setDescription(
					`React with <:GreenCheck:857976926941478923> to get \`${
						perm.name
					}\` in <#${channel.id}>!${
						time != null
							? `\nYour perm will be removed at <t:${Math.floor(
									(now.getTime() + time) / 1000
							  )}>, <t:${Math.floor(
									(now.getTime() + time) / 1000
							  )}:R>`
							: ""
					}`
				)
				.setAuthor(
					"Powered by Kifo Clanker™",
					message.guild.me?.user?.avatarURL({
						format: "png",
						dynamic: true,
						size: 64,
					}),
					"https://kifopl.github.io/kifo-clanker/"
				)
				.setFooter(
					`Issued by ${message.member.displayName} - ${
						message.member.id
					} at ${now.toUTCString()}.`
				);

			message
				.reply(newEmbed)
				.then((cbmsg) => {
					con.query(
						"INSERT INTO menu_perms (GuildId , ChannelId, CmdMsgId, CmdChId, DestinationChannelId , MessageId , PermName , EndDate , StartDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
						[
							cbmsg.guild.id,
							cbmsg.channel.id,
							message.id,
							message.channel.id,
							channel.id,
							cbmsg.id,
							perm.name,
							time != null
								? new Date(now.getTime() + time)
								: null,
							cbmsg.createdAt,
						],
						function (err) {
							if (err) throw err;
						}
					);
					main.menus.set(cbmsg.id, {
						MessageId: cbmsg.id,
						ChannelId: cbmsg.channel.id,
						GuildId: cbmsg.guild.id,
						isPerm: true,
						DestinationChannelId: channel.id,
						PermName: perm.name,
					});
					cbmsg
						.react("<:GreenCheck:857976926941478923>")
						.catch((err) => {
							main.log(err);
						});
				})
				.catch((err) => {
					message
						.reply(kifo.embed(err, "Unable to create perm menu!"))
						.catch((err) => {
							main.log(err);
						});
					main.log(err);
				});
		}
		//TODO KIFO menu REVERT messageIdOrUrl
		else if (args[0].toLowerCase() == "revert") {
			let msg = undefined;
			let msgID = undefined;
			let msgResolvable = args[1];
			if (msgResolvable.match(kifo.urlRegex())) {
				let urlArray = args[1].split("/");
				msgID = urlArray[urlArray.length - 1];
				// msg = await message.guild.channels
				// 	.resolve(channelID)
				// 	.fetch(msgID);
			} else msgID = msgResolvable;
			con.query(
				"SELECT Id, GuildId, ChannelId, MessageId, RoleId, EndDate, StartDate FROM menu_roles WHERE MessageId = ? AND GuildId = ?",
				[msgID, message.guild.id],
				async function (err, result) {
					if (err) throw err;
					if (result.length > 0) {
						msg = await message.guild.channels
							.resolve(result[0].ChannelId)
							.messages.fetch(result[0].MessageId);
						revert(
							message,
							msg,
							false,
							message.guild.roles.resolve(result[0].RoleId)
						);
					} else
						con.query(
							"SELECT Id, GuildId, ChannelId, MessageId, PermName, EndDate, StartDate, DestinationChannelId FROM menu_perms WHERE GuildId = ? AND MessageId = ?",
							[message.guild.id, msgID],
							async function (err1, result1) {
								if (err1) throw err1;
								if (result1.length > 0) {
									msg = await message.guild.channels
										.resolve(result1[0].ChannelId)
										.messages.fetch(result1[0].MessageId);
									revert(
										message,
										msg,
										true,
										message.guild.channels.resolve(
											result1[0].DestinationChannelId
										),
										result1[0].PermName
									);
								} else
									return message
										.reply(kifo.embed("Message not found!"))
										.catch(() => {});
							}
						);
				}
			);
		} else
			return message
				.reply(
					kifo.embed(`Invalid syntax!\n- ${this.usage.join("\n- ")}`)
				)
				.catch(() => {});
	}
}
