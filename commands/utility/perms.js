const { MessageMentions } = require("discord.js");
const kifo = require("kifo");
const fs = require("fs");
const time = new Date(Date.now());
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
		aliases: ["stts", "ttsm", "msgtts", "ttsmsg"],
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
		"This powerful command manages permissions for channels and categories.\n- **ADD** - allows a perm (green check), \n- **DENY** - denies a perm (red x),\n- **RM** - removes a perm (grey /).\nExcept for primary usage (that changes perms), you can also do:\n\
		`!kifo perms` - checks if you have permissions to manage channel, lists aliases and IDs of permissions for easier cmd usage.\n\
		`!kifo perms <channel_or_category_id>` - lists perms of all roles and members in a `.txt` file\n\
		`!kifo perms \"here\"/\"list\"` - list perms of all roles and members for this channel in a `.txt` file\n\
		`!kifo perms <user_or_role_id>` - lists perms for specific user/role",
	usage: "!kifo perms <add/rm/deny> <perm> <role_or_user_id_1> ... <role_or_user_id_n>",
	adminonly: true,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS"],
	async execute(message, args, Discord) {
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
		//`!kifo perms`
		if (!args[0]) {
			let description = `You ${
				!hasRequiredPerms ? `DON'T HAVE` : `HAVE`
			} required perms to use \`perms\` command in #${message.channel.name}.`;
			description += `\nThe bot ${
				!botHasRequiredPerms ? `DOESN'T HAVE` : `HAS`
			} required perms to execute \`perms\` command in #${message.channel.name}.`;
			description += `\n**Syntax:** \`${this.usage}\``;
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
					"https://github.com/KifoPL/kifo-clanker/"
				)
				.setFooter(
					`Issued by ${message.member.displayName} - ${
						message.member.id
					} at ${time.toUTCString()}.`
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
			message.reply(kifo.embed("Check your DM!"))
		}
		//!kifo perms <user_or_role_or_channel_id>
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
				if (args[0].toLowerCase() == "here" || args[0].toLowerCase() == "list") entity = message.channel;
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
							"https://github.com/KifoPL/kifo-clanker/"
						)
						.setFooter(
							`Issued by ${message.member.displayName} - ${
								message.member.id
							} at ${time.toUTCString()}.`
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
						`Incorrect syntax. Use \`!kifo perms\`, or \`!kifo help perms\` for more details.\nSyntax: ${this.usage}`
					)
				);
			} else {
				if (
					args[0].toLowerCase().match(new RegExp(`add|rm|deny`)) ==
					null
				)
					return message.reply(
						kifo.embed(
							`I don't know what ${args[0]} is supposed to mean. Type \`!kifo perms\` or \`!kifo help perms\` to learn about this command.\nSyntax: \`${this.usage}\``
						)
					);
				let perm = channelPerms.find(
					(permOver) =>
						permOver.aliases.includes(args[1].toLowerCase()) ||
						permOver.name.toLowerCase() == args[1].toLowerCase() || permOver.Id == args[1]
				);
				if (perm == undefined) {
					return message.reply(
						kifo.embed(
							`Unrecognized perm alias. Type \`!kifo perms\` to see a list of perms available for this channel.`
						)
					);
				}

				let IDInput = args.slice(2);
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
						"https://github.com/KifoPL/kifo-clanker/"
					)
					.setFooter(
						`Issued by ${message.member.displayName} - ${
							message.member.id
						} at ${time.toUTCString()}.`
					);

				fileContent += `\nUpdated perms:\n\n`;
				fileContent += `Type\tID\tName\t+/-\tPerms\n`;
				if (args[0].toLowerCase() == "add") {
					newEmbed.setTitle(
						`${message.member.displayName} added ${perm.name} in ${message.channel.name}.`
					);
					//let overArr = [];
					IDArray.forEach((ID) => {
						//overArr.push({ id: ID, allow: [perm.name] });
						message.channel.updateOverwrite(ID, {
							[perm.name]: true
						})
						fileContent += `${
							message.guild.members.resolve(ID) != null
								? `member`
								: `role`
						}\t${ID}\t${
							message.guild.members.resolve(ID) != null
								? message.guild.members.resolve(ID).displayName
								: message.guild.roles.resolve(ID).name
						}\t+\t${perm.name}\n`;
					});
					//message.channel.updateOverwrite(overArr);
				} else if (args[0].toLowerCase() == "rm") {
					newEmbed.setTitle(
						`${message.member.displayName} removed ${perm.name} in ${message.channel.name}.`
					);
					IDArray.forEach((ID) => {
						message.channel.permissionOverwrites
							.filter((permOver1) => permOver1.id == ID)
							.each((permOver) => {
								permOver.update({
									[perm.name]: null,
								});
								fileContent += `${
									permOver.type == "member"
										? `member`
										: `role`
								}\t${permOver.id}\t${
									permOver.type == "member"
										? message.guild.members.resolve(
												permOver.id
										  ).displayName
										: message.guild.roles.resolve(
												permOver.id
										  ).name
								}\t/\t${perm.name}\n`;
							});
					});
				} else if (args[0].toLowerCase() == "deny") {
					newEmbed.setTitle(
						`${message.member.displayName} denied ${perm.name} in ${message.channel.name}.`
					);
					//let overArr = [];
					IDArray.forEach((ID) => {
						//overArr.push({ id: ID, deny: [perm.name] });
						message.channel.updateOverwrite(ID, {
							[perm.name]: false
						})
						fileContent += `${
							message.guild.members.resolve(ID) != null
								? `member`
								: `role`
						}\t${ID}\t${
							message.guild.members.resolve(ID) != null
								? message.guild.members.resolve(ID).displayName
								: message.guild.roles.resolve(ID).name
						}\t-\t${perm.name}\n`;
					});
					// message.channel.overwritePermissions(overArr);
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
				////console.log("DID IT WORK?")
				await message.reply(newEmbed);
				try {
					fs.unlink(
						`./${message.guild.id}_${message.channel.id} perms.txt`,
						() => {}
					).catch(() => {});
				} catch (err) {}
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
				"https://github.com/KifoPL/kifo-clanker/"
			)
			.setFooter(
				`Issued by ${message.member.displayName} - ${
					message.member.id
				} at ${time.toUTCString()}.`
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
