const { MessageMentions } = require("discord.js");

const kifo = require("kifo");
const fs = require("fs");
const ms = require("ms");
const now = new Date(Date.now());
const channelPerms = [
	//below perms are for text channels
	(VIEW_CHANNEL = {
		Id: 1,
		name: "VIEW_CHANNEL",
		type: "text",
		aliases: ["view", "vch"],
	}),
	(MANAGE_CHANNELS = {
		Id: 2,
		name: "MANAGE_CHANNELS",
		type: "text",
		aliases: ["mngc"],
	}),
	(MANAGE_ROLES = {
		Id: 3,
		name: "MANAGE_ROLES",
		type: "text",
		aliases: ["mngr"],
	}),
	(MANAGE_WEBHOOKS = {
		Id: 4,
		name: "MANAGE_WEBHOOKS",
		type: "text",
		aliases: ["mngw", "webhooks"],
	}),
	(CREATE_INSTANT_INVITE = {
		Id: 5,
		name: "CREATE_INSTANT_INVITE",
		type: "text",
		aliases: ["cri", "invites", "inv"],
	}),
	(SEND_MESSAGES = {
		Id: 6,
		name: "SEND_MESSAGES",
		type: "text",
		aliases: ["sm", "msg", "msgs"],
	}),
	(EMBED_LINKS = {
		Id: 7,
		name: "EMBED_LINKS",
		type: "text",
		aliases: ["el", "embed", "links"],
	}),
	(ATTACH_FILES = {
		Id: 8,
		name: "ATTACH_FILES",
		type: "text",
		aliases: ["af", "files"],
	}),
	(ADD_REACTIONS = {
		Id: 9,
		name: "ADD_REACTIONS",
		type: "text",
		aliases: ["ar", "reactions"],
	}),
	(USER_EXTERNAL_EMOJIS = {
		Id: 10,
		name: "USER_EXTERNAL_EMOJIS",
		type: "text",
		aliases: ["uee", "emojis"],
	}),
	(MENTION_EVERYONE = {
		Id: 11,
		name: "MENTION_EVERYONE",
		type: "text",
		aliases: ["evr", "me", "every1"],
	}),
	(MANAGE_MESSAGES = {
		Id: 12,
		name: "MANAGE_MESSAGES",
		type: "text",
		aliases: ["mngm", "mmsg"],
	}),
	(READ_MESSAGE_HISTORY = {
		Id: 13,
		name: "READ_MESSAGE_HISTORY",
		type: "text",
		aliases: ["rmh", "msgh", "history"],
	}),
	(SEND_TTS_MESSAGES = {
		Id: 14,
		name: "SEND_TTS_MESSAGES",
		type: "text",
		aliases: ["stts", "tts", "ttsm", "msgtts", "ttsmsg"],
	}),
	//WARNING Discord v12.0 does not have `Use Slash Commands` perms yet. Update when v13.0 is live
	//voice perms
	(CONNECT = {
		Id: 15,
		name: "CONNECT",
		type: "voice",
		aliases: ["cnt", "con"],
	}),
	(SPEAK = {
		Id: 16,
		name: "SPEAK",
		type: "voice",
		aliases: ["spk", "say", "talk"],
	}),
	(STREAM = {
		Id: 17,
		name: "STREAM",
		type: "voice",
		aliases: ["str", "vid", "video", "scr", "screen", "share"],
	}),
	(USE_VAD = {
		Id: 18,
		name: "USE_VAD",
		type: "voice",
		aliases: ["vad", "vca", "vcad", "vact"],
	}),
	(PRIORITY_SPEAKER = {
		Id: 19,
		name: "PRIORITY_SPEAKER",
		type: "voice",
		aliases: ["pspk", "psay", "ptalk"],
	}),
	(MUTE_MEMBERS = {
		Id: 20,
		name: "MUTE_MEMBERS",
		type: "voice",
		aliases: ["mm", "mute", "mtm"],
	}),
	(DEAFEN_MEMBERS = {
		Id: 21,
		name: "DEAFEN_MEMBERS",
		type: "voice",
		aliases: ["dm", "deafen", "deaf", "dfm"],
	}),
	(MOVE_MEMBERS = {
		Id: 22,
		name: "MOVE_MEMBERS",
		type: "voice",
		aliases: ["move", "mvm", "movm"],
	}),
	//WARNING: REQUEST TO SPEAK IS NOT IN discord.js v12.0
	//UPDATE WHEN it's updated
	//so, with those 2 it will be 22 perms, I only have one field left.
];

module.exports = {
	name: "perms",
	description:
		"This powerful command manages permissions for channels and categories.\n- **ADD** - allows a perm (green check), \n- **DENY** - denies a perm (red x),\n- **RM** - removes a perm (grey /).",
	usage: [
		"`perms` - checks if you have permissions to manage channel, lists aliases and IDs of permissions for easier cmd usage.",
		'`perms "here"/"list"` - list perms of all roles and members for this channel in a `.txt` file',
		"`perms <user_or_role_id>` - lists perms for specific user/role",
		"`perms <channel_or_category_id>` - lists perms of all roles and members in a `.txt` file",
		"`perms <add/rm/deny> <perm> <role_or_user_id_1> ... <role_or_user_id_n>` - adds/removes/denies perms for provided users and roles in this channel. <perm> can be either full name, id (number), or alias of a perm.",
		"`perms <add/rm/deny> <perm> <role_or_user_id_1> ... <role_or_user_id_n> <time_period>` - adds/removes/denies perms for provided users and roles in this channel, then reverts the changes after <time_period>. <perm> can be either full name, id (number), or alias of a perm.",
	],
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	async execute(message, args, Discord, prefix) {
		const { con } = require("../../index.js");
		//precheck
		if (!message.guild == null)
			return message
				.reply(kifo.embed(`you can only run this command in a server!`))
				.catch(() => {});
		const hasRequiredPerms =
			message.member
				.permissionsIn(message.channel)
				.has("MANAGE_CHANNELS") &&
			message.member.permissionsIn(message.channel).has("MANAGE_ROLES");
		const botHasRequiredPerms =
			message.guild.me
				.permissionsIn(message.channel)
				.has("MANAGE_CHANNELS") &&
			message.guild.me.permissionsIn(message.channel).has("MANAGE_ROLES");
		//`perms`
		if (!args[0]) {
			let description = `You ${
				!hasRequiredPerms ? `DON'T HAVE` : `HAVE`
			} required perms to use \`perms\` command in <#${
				message.channel.id
			}>.`;
			description += `\nThe bot ${
				!botHasRequiredPerms ? `DOESN'T HAVE` : `HAS`
			} required perms to execute \`perms\` command in <#${
				message.channel.id
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
					`Issued by ${message.member.displayName} - ${
						message.member.id
					} at ${now.toUTCString()}.`
				);
			//write all aliases of all text channel perms.
			channelPerms.forEach(async (perm) => {
				if (perm.type == "text") {
					newEmbed.addField(
						`${perm.Id}. ${perm.name}`,
						`${perm.aliases.join(", ")}`,
						false
					);
				}
			});

			message.author.send(newEmbed).catch();
			message.reply(kifo.embed("Check your DM!"));
		}
		//perms <user_or_role_or_channel_id>
		else {
			if (!hasRequiredPerms)
				return message.reply(
					kifo.embed(
						`You do not have required permissions to run this command.\nRequired perms: \`MANAGE_CHANNELS\` and \`MANAGE_ROLES\`.\nYou have: ${message.member
							.permissionsIn(message.channel)
							.toArray()
							.join(", ")}.`,
						"Missing permissions!"
					)
				);
			if (!botHasRequiredPerms)
				return message.reply(
					kifo.embed(
						`I do not have required permissions to run this command.\nI need \`MANAGE_CHANNELS\` and \`MANAGE_ROLES\`.\nI have: ${message.guild?.me
							.permissionsIn(message.channel)
							.toArray()
							.join(", ")}.`,
						"Missing permissions!"
					)
				);
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
							return message.reply(
								kifo.embed(
									"Please input either user, role, channel ID or mention."
								)
							);
						}
					}
				}
				const fs = require("fs");

				//LIST CHANNEL PERMS
				if (whatami == "channel") {
					channelPermsfunc(message, entity, Discord);
				} else if (whatami == "member" || whatami == "role") {
					let description = `${
						whatami == "member" ? "User <@" : "Role <@&"
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
						description += `No permission overwrites for ${
							whatami == "member" ? `<@` : `<@&`
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
							`Issued by ${message.member.displayName} - ${
								message.member.id
							} at ${now.toUTCString()}.`
						);
					message.channel.permissionOverwrites
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
					message.reply(newEmbed);
				}
			} else if (!args[2]) {
				return message.reply(
					kifo.embed(
						`Incorrect syntax. Use \`${prefix}perms\`, or \`${prefix}help perms\` for more details.\nSyntax: ${this.usage}`
					)
				);
			} else {
				if (
					args[0].toLowerCase().match(new RegExp(`add|rm|deny`)) ==
					null
				)
					return message.reply(
						kifo.embed(
							`I don't know what ${args[0]} is supposed to mean. Type \`${prefix}perms\` or \`${prefix}help perms\` to learn about this command.\nSyntax: \`${this.usage}\``
						)
					);
				let perm = channelPerms.find(
					(permOver) =>
						permOver.aliases.includes(args[1].toLowerCase()) ||
						permOver.name.toLowerCase() == args[1].toLowerCase() ||
						permOver.Id == args[1]
				);
				if (perm == undefined) {
					return message.reply(
						kifo.embed(
							`Unrecognized perm alias. Type \`${prefix}perms\` to see a list of perms available for this channel.`
						)
					);
				}

				let time = args.pop();
				let end = undefined;
				let IDInput = args.slice(2);

				if (
					time.match(MessageMentions.USERS_PATTERN) ||
					time.match(MessageMentions.ROLES_PATTERN)
				) {
					IDInput.push(time);
					time = undefined;
				}

				if (
					message.guild.members.resolve(time) != null ||
					message.guild.roles.resolve(time) != null
				) {
					IDInput.push(time);
					time = undefined;
				}

				if (time !== undefined) {
					if (isNaN(ms(time)))
						return message
							.reply(
								kifo.embed(
									"Incorrect last argument! The last argument needs to be either `user`, `role` or `time period`."
								)
							)
							.catch(() => {});
					if (ms(time) < 1000 * 60)
						return message
							.reply(
								kifo.embed("Set the time to at least a minute!")
							)
							.catch(() => {});
					end = new Date(now.getTime() + ms(time));
				}
				let stop = false;

				//console.log(`IDINPUT ${IDInput}`);
				let IDArray = [];
				IDInput.forEach((ID) => {
					if (
						ID.match(MessageMentions.USERS_PATTERN) ||
						ID.match(MessageMentions.ROLES_PATTERN)
					) {
						IDArray.push(ID.slice(3, -1));
						//console.log("sliced!")
					} else {
						IDArray.push(ID);
						//console.log("NOT sliced!")
					}
				});
				IDArray.forEach((ID) => {
					if (
						message.guild.members.resolve(ID) == null &&
						message.guild.roles.resolve(ID) == null
					) {
						return message.reply(
							kifo.embed(
								`There is no role/member with \`${ID}\` ID.`
							)
						);
					} else {
						let mm = message.guild.members.resolve(ID);
						if (mm != null) {
							if (
								mm.roles.highest.rawPosition >=
								message.member.roles.highest.rawPosition
							)
								return message.reply(
									kifo.embed(
										`You can't edit <@!${mm.id}>'s perms!`
									)
								);
							if (
								mm.roles.highest.rawPosition >=
								message.guild.me.roles.highest.rawPosition
							)
								return message.reply(
									kifo.embed(
										`I can't edit <@!${mm.id}>'s perms!`
									)
								);
						} else {
							mm = message.guild.roles.resolve(ID);
							if (
								mm.rawPosition >=
								message.member.roles.highest.rawPosition
							)
								return message.reply(
									kifo.embed(
										`You can't edit <@&${mm.id}>'s perms!`
									)
								);
							if (
								mm.rawPosition >=
								message.guild.me.roles.highest.rawPosition
							)
								return message.reply(
									kifo.embed(
										`I can't edit <@&${mm.id}>'s perms!`
									)
								);
						}
					}
				});
				// let PermsCollection =
				// 	message.channel.permissionOverwrites.filter((permOver) =>
				// 		IDArray.includes(permOver.id)
				// 	);

				// if (PermsCollection.first() == undefined) {
				// 	return message.reply(
				// 		kifo.embed("No roles/users with given IDs found.")
				// 	);
				// }

				fileContent = `Previous channel permissions:\n\n`;
				fileContent += `Type\tID\tName\t+/-\tPerms\n`;
				message.channel.permissionOverwrites.each((permOver) => {
					if (permOver.allow.toArray().length > 0) {
						fileContent += `${
							permOver.type == "member" ? `member` : `role`
						}\t${permOver.id}\t${
							permOver.type == "member"
								? message.guild.members.resolve(permOver.id)
										.displayName
								: message.guild.roles.resolve(permOver.id).name
						}\t+\t${permOver.allow.toArray().join("\t")}\n`;
					}
					if (permOver.deny.toArray().length > 0) {
						fileContent += `${
							permOver.type == "member" ? `member` : `role`
						}\t${permOver.id}\t${
							permOver.type == "member"
								? message.guild.members.resolve(permOver.id)
										.displayName
								: message.guild.roles.resolve(permOver.id).name
						}\t-\t${permOver.deny.toArray().join("\t")}\n`;
					}
				});

				let description =
					"Detailed list of changes is available in attached `.txt` file.\nRoles and users affected by the command:\n";
				//console.log(IDArray);
				IDArray.forEach((Id) => {
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
						`${message.member.displayName} ${
							args[0].toLowerCase() == "add"
								? "added"
								: args[0].toLowerCase() == "rm"
								? "removed"
								: "denied"
						} ${perm.name} in ${message.channel.name}.`
					)
					.setFooter(
						`Issued by ${message.member.displayName} - ${
							message.member.id
						} at ${now.toUTCString()}.`
					);

				fileContent += `\nUpdated perms:\n\n`;
				fileContent += `Type\tID\tName\t+/-\tPerms\n`;

				IDArray.forEach(async (ID) => {
					if (stop)
						return message
							.reply(
								kifo.embed(
									err,
									`Unable to change permissions for ${ID}!`
								)
							)
							.catch(() => {});
					let previous = "rm";
					if (
						message.channel.permissionOverwrites
							.get(ID)
							?.allow.has(perm.name)
					) {
						previous = "add";
					} else if (
						message.channel.permissionOverwrites
							.get(ID)
							?.deny.has(perm.name)
					) {
						previous = "deny";
					}
					fileContent += `${
						message.guild.members.resolve(ID) != null
							? `member`
							: `role`
					}\t${ID}\t${
						message.guild.members.resolve(ID) != null
							? message.guild.members.resolve(ID).displayName
							: message.guild.roles.resolve(ID).name
					}\t${
						args[0].toLowerCase() == "add"
							? "+"
							: args[0].toLowerCase() == "rm"
							? "/"
							: "-"
					}\t${perm.name}\n`;
					await message.channel
						.updateOverwrite(ID, {
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
										ID,
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
								.reply(
									kifo.embed(
										err,
										`Unable to change permissions for ${ID}!`
									)
								)
								.catch(() => {});
						});
				});
				if (stop) {
					return message
						.reply(
							kifo.embed(
								"Unexpected error. Command exited without changing state."
							)
						)
						.catch(() => {});
				}
				fs.writeFileSync(
					`./${message.guild.id}_${message.channel.id} perms.txt`,
					fileContent,
					() => {}
				);
				newEmbed.attachFiles([
					{
						attachment: `./${message.guild.id}_${message.channel.id} perms.txt`,
						name: `${message.guild.id}_${message.channel.id} perms.txt`,
					},
				]);
				if (time !== undefined) {
					await message.reply(
						`I'll revert the perms at <t:${Math.floor(
							end.getTime() / 1000
						)}>, <t:${Math.floor(end.getTime() / 1000)}:R>`,
						newEmbed
					);
				} else await message.reply(newEmbed);
				try {
					fs.unlink(
						`./${message.guild.id}_${message.channel.id} perms.txt`,
						() => {}
					).catch(() => {});
				} catch (err) {}

				////console.log("DID IT WORK?")
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
	if (entity.type == "store")
		return message.reply(
			kifo.embed("Store channels are not implemented yet.")
		);
	let description =
		"Detailed list of permissions is attached in `.txt` file.\n";
	//console.log(`${entity.parent?.name}\n${entity.permissionsLocked}`);
	//TODO THIS DOES NOT WORK, WEIRD BEHAVIOUR
	if (entity.parent != null && entity.permissionsLocked) {
		description += `Permissions are synchronised with **"${entity.parent.name}"** category.\n`;
	}
	let fileContent = "Type\tID\tName\t+/-\tPerms\n";

	entity.permissionOverwrites.each((permOver) => {
		if (permOver.allow.toArray().length > 0) {
			fileContent += `${permOver.type}\t${permOver.id}\t${
				permOver.type == "member"
					? message.guild.members.resolve(permOver.id).displayName
					: message.guild.roles.resolve(permOver.id).name
			}\t+\t${permOver.allow.toArray().join("\t")}\n`;
		}
		if (permOver.deny.toArray().length > 0) {
			fileContent += `${permOver.type}\t${permOver.id}\t${
				permOver.type == "member"
					? message.guild.members.resolve(permOver.id).displayName
					: message.guild.roles.resolve(permOver.id).name
			}\t-\t${permOver.deny.toArray().join("\t")}\n`;
		}
	});

	if (!justFileContent) {
		fs.writeFileSync(
			`./${message.guild.id}_${entity.id} perms.txt`,
			fileContent,
			() => {}
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
				`Issued by ${message.member.displayName} - ${
					message.member.id
				} at ${now.toUTCString()}.`
			)
			.attachFiles([
				{
					attachment: `./${message.guild.id}_${entity.id} perms.txt`,
					name: `${message.guild.id}_${entity.id} perms.txt`,
				},
			]);
		await message.reply(newEmbed);
		try {
			fs.unlink(
				`./${message.guild.id}_${entity.id} perms.txt`,
				() => {}
			).catch(() => {});
		} catch (err) {}
	}
}
