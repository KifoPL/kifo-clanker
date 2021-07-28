const { MessageMentions } = require("discord.js");

const kifo = require("kifo");
const fs = require("fs");
const ms = require("ms");
const now = new Date(Date.now());
const Discord = require("discord.js");

module.exports = {
	name: "perms",
	description:
		"This powerful command manages permissions for channels and categories.\n- **ADD** - allows a perm (green check), \n- **DENY** - denies a perm (red x),\n- **RM** - removes a perm (grey /).",
	usage: [
		"`perms` - checks if you have permissions to manage channel, lists aliases and Ids of permissions for easier cmd usage.",
		'`perms "here"/"list"` - list perms of all roles and members for this channel in a `.txt` file',
		"`perms <user_or_role_id>` - lists perms for specific user/role",
		"`perms <channel_or_category_id>` - lists perms of all roles and members in a `.txt` file",
		"`perms <add/rm/deny> <perm> <role_or_user_id_1> ... <role_or_user_id_n>` - adds/removes/denies perms for provided users and roles in this channel. <perm> can be either full name, id (number), or alias of a perm.",
		"`perms <add/rm/deny> <perm> <role_or_user_id_1> ... <role_or_user_id_n> <time_period>` - adds/removes/denies perms for provided users and roles in this channel, then reverts the changes after <time_period>. <perm> can be either full name, id (number), or alias of a perm.",
	],
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	async execute(message, args, prefix) {
		const { con } = require("../../index.js");
		//precheck
		if (!message.guild == null)
			return message
				.reply({ embeds: [kifo.embed(`you can only run this command in a server!`)] })
				.catch(() => { });
		const hasRequiredPerms =
			message.member
				.permissionsIn(message.channel)
				.has(Discord.Permissions.FLAGS.MANAGE_CHANNELS) &&
			message.member.permissionsIn(message.channel).has(Discord.Permissions.FLAGS.MANAGE_ROLES);
		const botHasRequiredPerms =
			message.guild.me
				.permissionsIn(message.channel)
				.has(Discord.Permissions.FLAGS.MANAGE_CHANNELS) &&
			message.guild.me.permissionsIn(message.channel).has(Discord.Permissions.FLAGS.MANAGE_ROLES);
		//`perms`
		if (!args[0]) {
			let description = `You ${!hasRequiredPerms ? `DON'T HAVE` : `HAVE`
				} required perms to use \`perms\` command in <#${message.channel.id
				}>.`;
			description += `\nThe bot ${!botHasRequiredPerms ? `DOESN'T HAVE` : `HAS`
				} required perms to execute \`perms\` command in <#${message.channel.id
				}>.`;
			description += `\n**Syntax:** ${this.usage.join("\n")}`;
			const newEmbed = new Discord.MessageEmbed()
				.setColor("a039a0")
				.setTitle(`__List of perms with their aliases:__`)
				.setDescription(description)
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
					`Issued by ${message.member.displayName} - ${message.member.id
					} at ${now.toUTCString()}.`
				);
			//write all aliases of all text channel perms.
			kifo.channelPerms.forEach(async (perm) => {
				if (perm.type == "text") {
					newEmbed.addField(
						`${perm.Id}. ${perm.name}`,
						`${perm.aliases.join(", ")}`,
						false
					);
				}
			});

			message.author.send({ embeds: [newEmbed] }).catch();
			message.reply({ embeds: [kifo.embed("Check your DM!")] });
		}
		//perms <user_or_role_or_channel_id>
		else {
			if (!hasRequiredPerms)
				return message.reply({
					embeds: [
						kifo.embed(
							`You do not have required permissions to run this command.\nRequired perms: \`MANAGE_CHANNELS\` and \`MANAGE_ROLES\`.\nYou have: ${message.member
								.permissionsIn(message.channel)
								.toArray()
								.join(", ")}.`,
							"Missing permissions!"
						)
					]
				});
			if (!botHasRequiredPerms)
				return message.reply({
					embeds: [
						kifo.embed(
							`I do not have required permissions to run this command.\nI need \`MANAGE_CHANNELS\` and \`MANAGE_ROLES\`.\nI have: ${message.guild?.me
								.permissionsIn(message.channel)
								.toArray()
								.join(", ")}.`,
							"Missing permissions!"
						)
					]
				});
			if (!args[1]) {
				let whatami = "";
				let entity = message.guild.channels.resolve(args[0]);
				let mention = args[0].match(MessageMentions.CHANNELS_PATTERN);
				if (
					args[0].toLowerCase() == "here" ||
					args[0].toLowerCase() == "list"
				)
					entity = message.channel;
				if (entity != null || mention != null) {
					whatami = "channel";
					if (entity == null)
						entity = message.guild.channels.resolve(
							args[0].slice(2, -1)
						);
				} else {
					entity = message.guild.roles.resolve(args[0]);
					mention = args[0].match(MessageMentions.ROLES_PATTERN);
					if (entity != null || mention != null) {
						whatami = "role";
						if (entity == null)
							entity = message.guild.roles.resolve(
								args[0].slice(3, -1)
							);
					} else {
						entity = message.guild.members.resolve(args[0]);
						mention = args[0].match(MessageMentions.USERS_PATTERN);
						if (entity != null || mention != null) {
							whatami = "member";
							if (entity == null)
								entity = await message.guild.members.resolve(
									args[0].slice(3, -1)
								);
						} else {
							return message.reply({
								embeds: [
									kifo.embed(
										"Please input either user, role, channel Id or mention."
									)
								]
							});
						}
					}
				}
				const fs = require("fs");

				//LIST CHANNEL PERMS
				if (whatami == "channel") {
					channelPermsfunc(message, entity, Discord);
				} else if (whatami == "member" || whatami == "role") {
					let description = `${whatami == "member" ? "User <@" : "Role <@&"
						}${entity.id}> permissions in <#${message.channel.id}>:\n`;
					// //console.log(
					// 	`${message.channel.parent?.name}\n${message.channel.permissionsLocked}`
					// );
					//TODO THIS DOES NOT WORK, WEIRD BEHAVIOUR
					if (
						message.channel.parent != null &&
						message.channel.permissionsLocked
					) {
						description += `Permissions are synchronised with **"${message.channel.parent.name}"** category.\n`;
					}
					if (!message.channel.permissionOverwrites.has(entity.id)) {
						description += `No permission overwrites for ${whatami == "member" ? `<@` : `<@&`
							}${entity.id}>.\n`;
					}

					const newEmbed = new Discord.MessageEmbed()
						.setColor("a039a0")
						.setTitle(
							`List of perms in #${message.channel.name} <#${message.channel.id}>:`
						)
						.setDescription(description)
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
							`Issued by ${message.member.displayName} - ${message.member.id
							} at ${now.toUTCString()}.`
						);
					message.channel.permissionOverwrites.cache
						.filter((perm) => perm.id == entity.id)
						.each((permOver) => {
							if (permOver.allow.toArray().length > 0) {
								newEmbed.addField(
									"Allowed:",
									`${permOver.allow.toArray().join(", ")}.`
								);
							}
							if (permOver.deny.toArray().length > 0) {
								newEmbed.addField(
									"Denied:",
									`${permOver.deny.toArray().join(", ")}.`
								);
							}
						});
					message.reply({ embeds: [newEmbed] });
				}
			} else if (!args[2]) {
				return message.reply({
					embeds: [
						kifo.embed(
							`Incorrect syntax. Use \`${prefix}perms\`, or \`${prefix}help perms\` for more details.\nSyntax: ${this.usage}`
						)
					]
				});
			} else {
				if (
					args[0].toLowerCase().match(new RegExp(`add|rm|deny`)) ==
					null
				)
					return message.reply({
						embeds: [
							kifo.embed(
								`I don't know what ${args[0]} is supposed to mean. Type \`${prefix}perms\` or \`${prefix}help perms\` to learn about this command.\nSyntax: \`${this.usage}\``
							)
						]
					});
				let perm = kifo.channelPerms.find(
					(permOver) =>
						permOver.aliases.includes(args[1].toLowerCase()) ||
						permOver.name.toLowerCase() == args[1].toLowerCase() ||
						permOver.Id == args[1]
				);
				if (perm == undefined) {
					return message.reply({
						embeds: [
							kifo.embed(
								`Unrecognized perm alias. Type \`${prefix}perms\` to see a list of perms available for this channel.`
							)
						]
					});
				}

				let time = args.pop();
				let end = undefined;
				let IdInput = args.slice(2);

				if (
					time.match(MessageMentions.USERS_PATTERN) ||
					time.match(MessageMentions.ROLES_PATTERN)
				) {
					IdInput.push(time);
					time = undefined;
				}

				if (
					message.guild.members.resolve(time) != null ||
					message.guild.roles.resolve(time) != null
				) {
					IdInput.push(time);
					time = undefined;
				}

				if (time !== undefined) {
					if (isNaN(ms(time)))
						return message
							.reply({
								embeds: [
									kifo.embed(
										"Incorrect last argument! The last argument needs to be either `user`, `role` or `time period`."
									)
								]
							})
							.catch(() => { });
					if (ms(time) < 1000 * 60)
						return message
							.reply({
								embeds: [
									kifo.embed("Set the time to at least a minute!")
								]
							})
							.catch(() => { });
					end = new Date(now.getTime() + ms(time));
				}
				let stop = false;

				//console.log(`IdINPUT ${IdInput}`);
				let IdArray = [];
				IdInput.forEach((Id) => {
					if (
						Id.match(MessageMentions.USERS_PATTERN) ||
						Id.match(MessageMentions.ROLES_PATTERN)
					) {
						IdArray.push(Id.slice(3, -1));
						//console.log("sliced!")
					} else {
						IdArray.push(Id);
						//console.log("NOT sliced!")
					}
				});
				IdArray.forEach((Id) => {
					if (stop) return;
					if (
						message.guild.members.resolve(Id) == null &&
						message.guild.roles.resolve(Id) == null
					) {
						return message.reply({
							embeds: [
								kifo.embed(
									`There is no role/member with \`${Id}\` Id.`
								)
							]
						});
					} else {
						let mm = message.guild.members.resolve(Id);
						if (mm != null) {
							if (
								mm.roles.highest.rawPosition >=
								message.member.roles.highest.rawPosition
							) {
								stop = true;
								return message.reply({
									embeds: [
										kifo.embed(
											`You can't edit <@!${mm.id}>'s perms!`
										)
									]
								});
							}
							if (
								mm.roles.highest.rawPosition >=
								message.guild.me.roles.highest.rawPosition
							) {
								stop = true;
								return message.reply({
									embeds: [
										kifo.embed(
											`I can't edit <@!${mm.id}>'s perms!`
										)
									]
								});
							}
						} else {
							mm = message.guild.roles.resolve(Id);
							if (
								mm.rawPosition >=
								message.member.roles.highest.rawPosition
							) {
								stop = true;
								return message.reply({
									embeds: [
										kifo.embed(
											`You can't edit <@&${mm.id}>'s perms!`
										)
									]
								});
							}
							if (
								mm.rawPosition >=
								message.guild.me.roles.highest.rawPosition
							) {
								stop = true;
								return message.reply({
									embeds: [
										kifo.embed(
											`I can't edit <@&${mm.id}>'s perms!`
										)
									]
								});
							}
						}
					}
				});
				if (stop) return;

				fileContent = `Previous channel permissions:\n\n`;
				fileContent += `Type\tId\tName\t+/-\tPerms\n`;
				message.channel.permissionOverwrites.cache.each((permOver) => {
					if (permOver.allow.toArray().length > 0) {
						fileContent += `${permOver.type == "member" ? `member` : `role`
							}\t${permOver.id}\t${permOver.type == "member"
								? message.guild.members.resolve(permOver.id)
								.displayName
								: message.guild.roles.resolve(permOver.id).name
							}\t+\t${permOver.allow.toArray().join("\t")}\n`;
					}
					if (permOver.deny.toArray().length > 0) {
						fileContent += `${permOver.type == "member" ? `member` : `role`
							}\t${permOver.id}\t${permOver.type == "member"
								? message.guild.members.resolve(permOver.id)
								.displayName
								: message.guild.roles.resolve(permOver.id).name
							}\t-\t${permOver.deny.toArray().join("\t")}\n`;
					}
				});

				let description =
					"Detailed list of changes is available in attached `.txt` file.\nRoles and users affected by the command:\n";
				//console.log(IdArray);
				IdArray.forEach((Id) => {
					//console.log(Id);
					if (message.guild.members.resolve(Id) == null) {
						let tempEnt = message.guild.roles.resolve(Id);
						description += `- role <@&${tempEnt.id}>\n`;
					} else {
						let tempEnt = message.guild.members.resolve(Id);
						description += `- user <@${tempEnt.id}>\n`;
					}
				});

				const newEmbed = new Discord.MessageEmbed()
					.setColor("a039a0")
					.setDescription(description)
					.setAuthor(
						"Kifo Clanker™, by KifoPL#3358",
						message.guild.me?.user?.avatarURL({
							format: "png",
							dynamic: true,
							size: 64,
						}),
						"https://kifopl.github.io/kifo-clanker/"
					)
					.setTitle(
						`${message.member.displayName} ${args[0].toLowerCase() == "add"
							? "added"
							: args[0].toLowerCase() == "rm"
								? "removed"
								: "denied"
						} ${perm.name} in ${message.channel.name}.`
					)
					.setFooter(
						`Issued by ${message.member.displayName} - ${message.member.id
						} at ${now.toUTCString()}.`
					);

				fileContent += `\nUpdated perms:\n\n`;
				fileContent += `Type\tId\tName\t+/-\tPerms\n`;

				IdArray.forEach(async (Id) => {
					if (stop)
						return message
							.reply({
								embeds: [
									kifo.embed(
										err,
										`Unable to change permissions for ${Id}!`
									)
								]
							})
							.catch(() => { });
					let previous = "rm";
					if (
						message.channel.permissionOverwrites.cache
							.get(Id)
							?.allow.has(perm.name)
					) {
						previous = "add";
					} else if (
						message.channel.permissionOverwrites.cache
							.get(Id)
							?.deny.has(perm.name)
					) {
						previous = "deny";
					}
					fileContent += `${message.guild.members.resolve(Id) != null
							? `member`
							: `role`
						}\t${Id}\t${message.guild.members.resolve(Id) != null
							? message.guild.members.resolve(Id).displayName
							: message.guild.roles.resolve(Id).name
						}\t${args[0].toLowerCase() == "add"
							? "+"
							: args[0].toLowerCase() == "rm"
								? "/"
								: "-"
						}\t${perm.name}\n`;
					await message.channel
						.permissionOverwrites.edit(Id, {
							[perm.name]:
								args[0].toLowerCase() == "add"
									? true
									: args[0].toLowerCase() == "rm"
										? null
										: false,
						})
						.then(() => {
							if (time !== undefined) {
								con.query(
									"INSERT INTO perms (PerpetratorId , MessageId, ChannelId , GuildId , PermId , PermFlag , EndTime , Command) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
									[
										message.author.id,
										message.id,
										message.channel.id,
										message.guild.id,
										Id,
										perm.name,
										end,
										previous,
									],
									function (err1) {
										stop = true;
										if (err1) throw err1;
									}
								);
							}
						})
						.catch((err) => {
							stop = true;
							return message
								.reply({
									embeds: [
										kifo.embed(
											err,
											`Unable to change permissions for ${Id}!`
										)
									]
								})
								.catch(() => { });
						});
				});
				if (stop) {
					return message
						.reply({
							embeds: [
								kifo.embed(
									"Unexpected error. Command exited without changing state."
								)
							]
						})
						.catch(() => { });
				}
				fs.writeFileSync(
					`./${message.guild.id}_${message.channel.id} perms.txt`,
					fileContent,
					() => { }
				);
				if (time !== undefined) {
					await message.reply({
						content:
							`I'll revert the perms at <t:${Math.floor(
								end.getTime() / 1000
							)}>, <t:${Math.floor(end.getTime() / 1000)}:R>`,
						embeds: [newEmbed], files: [`./${message.guild.id}_${message.channel.id} perms.txt`]
					});
				} else await message.reply({ embeds: [newEmbed] });
				try {
					fs.unlink(
						`./${message.guild.id}_${message.channel.id} perms.txt`,
						() => { }
					).catch(() => { });
				} catch (err) { }

				////console.log("DId IT WORK?")
			}
		}
	},
};

async function channelPermsfunc(
	message,
	entity,
	Discord,
	justFileContent = false
) {
	if (entity.type == "GUILD_STORE")
		return message.reply({
			embeds: [
				kifo.embed("Store channels are not implemented yet.")
			]
		});
	let description =
		"Detailed list of permissions is attached in `.txt` file.\n";
	//console.log(`${entity.parent?.name}\n${entity.permissionsLocked}`);
	//TODO THIS DOES NOT WORK, WEIRD BEHAVIOUR
	if (entity.parent != null && entity.permissionsLocked) {
		description += `Permissions are synchronised with **"${entity.parent.name}"** category.\n`;
	}
	let fileContent = "Type\tId\tName\t+/-\tPerms\n";

	entity.permissionOverwrites.cache.each((permOver) => {
		if (permOver.allow.toArray().length > 0) {
			fileContent += `${permOver.type}\t${permOver.id}\t${permOver.type == "member"
					? message.guild.members.resolve(permOver.id).displayName
					: message.guild.roles.resolve(permOver.id).name
				}\t+\t${permOver.allow.toArray().join("\t")}\n`;
		}
		if (permOver.deny.toArray().length > 0) {
			fileContent += `${permOver.type}\t${permOver.id}\t${permOver.type == "member"
					? message.guild.members.resolve(permOver.id).displayName
					: message.guild.roles.resolve(permOver.id).name
				}\t-\t${permOver.deny.toArray().join("\t")}\n`;
		}
	});

	if (!justFileContent) {
		fs.writeFileSync(
			`./${message.guild.id}_${entity.id} perms.txt`,
			fileContent,
			() => { }
		);
		const newEmbed = new Discord.MessageEmbed()
			.setColor("a039a0")
			.setTitle(`List of perms in #${entity.name} <#${entity.id}>:`)
			.setDescription(description)
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
				`Issued by ${message.member.displayName} - ${message.member.id
				} at ${now.toUTCString()}.`
			)
		await message.reply({ embeds: [newEmbed], files: [`./${message.guild.id}_${entity.id} perms.txt`] });
		try {
			fs.unlink(
				`./${message.guild.id}_${entity.id} perms.txt`,
				() => { }
			).catch(() => { });
		} catch (err) { }
	}
}
