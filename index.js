//libraries
const Discord = require("discord.js");
require("dotenv")?.config();
const fs = require("fs");
const ms = require("ms");
const kifo = require("kifo");
const main = require(`./index.js`);

//client login
const client = new Discord.Client({
	partials: [`MESSAGE`, `CHANNEL`, `REACTION`],
});

//Owner is Discord User @KifoPL#3358 - <@289119054130839552>
async function loadowner() {
	clientapp = await client.fetchApplication().catch(() => { });
	Owner = clientapp.owner;
	console.log("Bot owner object loaded!");
}

//DATABASE CONNECTION
const mysql = require("mysql");
const prefixes = new Map();
/**
 * @example
 * "menuId" = {
	MessageId: "", //The same as menuId
	ChannelId: "",
	GuildId: "",

	isPerm: true,
	DestinationChannelId: "",
	PermName: "",

	isPerm: false,
	RoleId = "",
}
 */
const menus = new Map();
module.exports.menus = menus;
// var reactMap = new Map();
// var superslowMap = new Map();
var dbconfig = {
	host: process.env.HOST,
	user: process.env.USER,
	password: process.env.PASSWORD,
	database: "kifo_clanker_db",
};
var con;
function dbReconnect() {
	con = mysql.createConnection(dbconfig);
	con.connect(async function (err) {
		if (err) {
			main.log(err);
			Owner?.send(kifo.embed(err, "Error:")).catch(() => { });
			setTimeout(dbReconnect, 3000);
		}
		console.log(`Connected to ${process.env.HOST} MySQL DB!`);
		module.exports.con = con;

		//for fetching prefixes from DB
		con.query(
			"SELECT Prefix, GuildId FROM prefixes",
			async function (err, result) {
				if (err) throw err;
				prefixes.clear();
				result.forEach((row) => {
					prefixes.set(row.GuildId, row.Prefix);
				});
			}
		);
		console.log(`Loaded prefixes!`);
	});

	con.on("error", function (err) {
		main.log(err);
		Owner?.send(kifo.embed(err, "Error:")).catch(() => { });
		if (err.code === "PROTOCOL_CONNECTION_LOST") {
			dbReconnect();
		} else {
			Owner?.send(kifo.embed(err, "Error BOT IS SHUT DOWN:")).catch(
				() => { }
			);
			throw err;
		}
	});
}

dbReconnect();

client.commands = new Discord.Collection();

const commandFolders = fs.readdirSync("./commands");
console.log("Loading commands...");
let i = 0;
for (const folder of commandFolders) {
	const commandFiles = fs
		.readdirSync(`./commands/${folder}`)
		.filter((file) => file.endsWith(".js"));
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		client.commands.set(command.name, command);
		console.log(`"${file.slice(0, -3)}"`);
		i++;
	}
}
console.log(`Loaded ${i} commands!`);
command = require(`./help.js`);
client.commands.set(command.name, command);

//Hello message
async function hello(message, prefix) {
	//I have to do it here too
	if (message.content.toLowerCase().trim() == prefix.toLowerCase().trim()) {
		if (message.deleted) return;
		message.channel.startTyping().catch(() => { });
		const event = new Date(Date.now());
		main.log(
			message.author.tag,
			"issued (welcome msg) in",
			message.channel.name,
			"at",
			event.toUTCString()
		);
		const helloEmbed = new Discord.MessageEmbed()
			.setAuthor(
				"Hello there (click for bot invite link)!",
				null,
				"https://discord.com/oauth2/authorize?client_id=795638549730295820&permissions=2416299088&scope=bot"
			)
			.setColor("a039a0")
			.setTitle(
				"See what's new! (click for invite to my bot-dev Discord Server)"
			)
			.setURL("https://discord.gg/HxUFQCxPFp")
			.setThumbnail(
				message.guild.me?.user?.avatarURL({
					format: "png",
					dynamic: true,
					size: 64,
				})
			)
			.addField(
				`Follow my GitHub repo`,
				"[LINK](https://github.com/KifoPL/kifo-clanker) - if you find a bug / have a cool idea for a new feature, please [create a ticket](https://github.com/KifoPL/kifo-clanker/issues/new/choose)."
			)
			.addField(
				`Check out top.gg page`,
				"[LINK](https://top.gg/bot/795638549730295820) - feel free to vote up and leave a 5 star review <a:done:828097348545544202>"
			)
			.addField(
				`try "${prefix}help"`,
				"This will list all commands available to you (you can see more commands if you're an Admin)!"
			)
			.addField(
				"\u200B",
				"This bot is developed by [KifoPL](https://github.com/KifoPL).\nDiscord: <@289119054130839552> : @KifoPL#3358\nReddit: [u/kifopl](http://reddit.com/u/kifopl)\n[Buy me a beer!](https://www.buymeacoffee.com/kifoPL) (developing bot takes a lot of time, by donating you help me pay for hosting / my electricity / internet bills!)"
			);
		message.channel.send(helloEmbed).catch(() => { });
		message.channel.stopTyping(true);
		return;
	}
}
//can be useful at some point in the future
function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

//IF CORRECT CHANNEL, REACT
async function react(message, prefix) {
	con.query(
		"SELECT ChannelId, emote FROM react WHERE ChannelId = ?",
		[message.channel.id],
		function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				if (!message.content.startsWith(prefix)) {
					//It will react to his own messages that have attachments, this is so #kenoc-hall-of-fame looks better
					if (message.author.id != client.user.id) {
						if (message.author.bot) return;
					} else {
						if (message.embeds[0] == null) return;
					}
					if (
						!message.guild.me
							.permissionsIn(message.channel)
							.has("ADD_REACTIONS")
					) {
						return message.reply(
							kifo.embed(
								"Missing `ADD_REACTIONS` permission. Please turn off `react` module in this channel, or enable `ADD_REACTIONS` for me."
							)
						);
					}
					var eventRT = new Date(Date.now());
					result.forEach((row) => {
						if (message.deleted) return;
						message.react(row.emote).catch(() => { });
					});
					main.log(
						"Reacted in " +
						message.guild.name +
						", " +
						message.channel.name +
						" at " +
						eventRT.toUTCString()
					);
				}
			}
		}
	);
}
//IF CORRECT CHANNEL, SUPERSLOWMODE
async function superslow(message, prefix) {
	con.query(
		"SELECT ChannelId, Time FROM superslow WHERE ChannelId = ?",
		[message.channel.id],
		async function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				if (
					!message.guild.me
						.permissionsIn(message.channel)
						.has("MANAGE_CHANNELS")
				) {
					const embedreply = new Discord.MessageEmbed();
					embedreply
						.setColor("a039a0")
						.setAuthor(
							"Powered by Kifo Clanker™",
							null,
							`https://discord.gg/HxUFQCxPFp`
						)
						.setTitle(
							"Missing `MANAGE_CHANNELS` permission. Please turn off `superslow` module in this channel, or enable `MANAGE_CHANNELS` for me."
						);
					return message.reply(embedreply);
				}
				if (
					!message.guild.me
						.permissionsIn(message.channel)
						.has("MANAGE_MESSAGES")
				) {
					const embedreply = new Discord.MessageEmbed();
					embedreply
						.setColor("a039a0")
						.setAuthor(
							"Powered by Kifo Clanker™",
							null,
							`https://discord.gg/HxUFQCxPFp`
						)
						.setTitle(
							"Missing `MANAGE_MESSAGES` permission. Please turn off `superslow` module in this channel, or enable `MANAGE_MESSAGES` for me."
						);
					return message.reply(embedreply);
				}
				if (
					!message.member
						.permissionsIn(message.channel)
						.has("MANAGE_MESSAGES")
				) {
					let slowmode = result[0].Time;
					con.query(
						"SELECT Id, UserId, timestamp, ChannelId FROM superslowusers WHERE UserId = ? AND ChannelId = ?",
						[message.author.id, message.channel.id],
						async function (err, result2) {
							if (err) throw err;
							// main.log(`${slowmode}, ${result2}`);
							if (result2.length > 0) {
								//if he can't send message yet
								if (
									result2[0].timestamp + slowmode >
									message.createdTimestamp
								) {
									if (
										message.content.trim() == prefix.trim()
									) {
										message.author
											.send(
												`You can't talk in ${message.channel.name
												} yet, please wait another ${ms(
													slowmode -
													(message.createdTimestamp -
														result2[0]
															.timestamp),
													{ long: true }
												)}.`
											)
											.catch(() => { });
										await message.delete().catch(() => { });
										return;
									} else {
										//I'm not kidding this msg works, because apparently subtraction forces integer type ¯\_(ツ)_/¯
										let msg =
											"You can't talk in " +
											message.channel.name +
											" for **" +
											ms(
												slowmode -
												(message.createdTimestamp -
													result2[0].timestamp),
												{
													long: true,
												}
											) +
											"**. You can check, if you can talk (without risking waiting another **" +
											ms(
												slowmode -
												(message.createdTimestamp -
													result2[0].timestamp) +
												(message.createdTimestamp -
													result2[0].timestamp),
												{ long: true }
											) +
											"**), by typing `" +
											prefix.trim() +
											"`.";
										message.author
											.send(msg)
											.catch(() => { });
										await message.delete().catch(() => { });
										return;
									}
								} else {
									if (
										message.content.trim() == prefix.trim()
									) {
										message.author
											.send(
												`You can already talk in #${message.channel.name}.`
											)
											.catch(() => { });
										await message.delete().catch(() => { });
										return;
									} else {
										con.query(
											"INSERT INTO superslowusers ( UserId ,Timestamp ,ChannelId ) VALUES ( ?, ?, ?);",
											[
												message.author.id,
												message.createdTimestamp,
												message.channel.id,
											],
											function (err) {
												if (err) throw err;
											}
										);
									}
								}
							} else {
								if (message.content.trim() == prefix.trim()) {
									message.author
										.send(
											`You can already talk in #${message.channel.name}.`
										)
										.catch(() => { });
									await message.delete().catch(() => { });
									return;
								} else
									con.query(
										"INSERT INTO superslowusers ( UserId ,Timestamp ,ChannelId ) VALUES ( ?, ?, ?)",
										[
											message.author.id,
											message.createdTimestamp,
											message.channel.id,
										],
										function (err) {
											if (err) throw err;
										}
									);
							}
						}
					);
				}
			} else {
				await hello(message, prefix).catch(() => { });
			}
		}
	);
}
//various checks if we can proceed with commands
function checks(message, prefix) {
	//No bot in #citizens

	//if (message.channel.id == "707650931809976391") return false;

	//Only me and @Tester can use Offline test
	if (
		message.content.startsWith(prefix.trim()) &&
		message.guild?.me.id == "796447999747948584"
	)
		if (
			message.author.id != "289119054130839552" &&
			message.member?.roles.cache.find(
				(role) => role.id == "832194217493135400"
			) == undefined
		) {
			main.log(`msg: ${message.content}`);
			message.reply(
				kifo.embed("Only KifoPL#3358 and testers can use this bot.")
			);
			return false;
		}

	if (!message.guild?.me.permissionsIn(message.channel).has("SEND_MESSAGES"))
		return false;

	return true;
}
async function commands(message, prefix) {
	//If command detected, create args struct
	let args = message.content.slice(prefix.length).split(/ +/);
	let command = args.shift().toLowerCase();

	if (command == "serverlist" && message.author == Owner) {
		main.log("run SERVERLIST command");
		let channel = client.guilds
			.resolve("822800862581751848")
			.channels?.resolve("864178555457372191");
		let serversarr = [];
		let serverembed = new Discord.MessageEmbed();
		await message.client.guilds.cache
			.sort((a, b) => b.memberCount - a.memberCount)
			.each((guild) => {
				serversarr.push({
					name: `${guild.id}\t${guild.name}\t`,
					value: `<:owner:823658022785908737> <@${guild.ownerID}> ${guild.owner.user.tag
						}, ${guild.memberCount} members. ${guild.available
							? "<:online:823658022974521414>"
							: "<:offline:823658022957613076> OUTAGE!"
						}`,
				});
			});
		serverembed
			.addFields(serversarr.slice(0, 10))
			.setTitle("Server list (top 10 by member count):")
			.setFooter(
				`I am in ${serversarr.length} servers as of ${new Date(
					Date.now()
				).toUTCString()}`
			)
			.setColor("a039a0");
		if (serversarr.length > 10) {
			fs.writeFileSync(
				`./serverlist.txt`,
				serversarr.map((x) => `${x.name}\n${x.value}`).join(`\n\n`),
				() => { }
			);
			await serverembed.attachFiles(`./serverlist.txt`, `serverlist.txt`);
		}
		channel
			.send(serverembed)
			.then(() => {
				try {
					fs.unlink(`./serverlist.txt`, () => { });
				} catch { }
			})
			.catch(() => { });
		return;
	}

	if (!client.commands.has(command)) {
		const embedreply = new Discord.MessageEmbed();
		embedreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(`Command ${command} not found.`)
			.addField(
				`Run \`${prefix}help\` to get list of available commands.`,
				`If you have a suggestion for a new command, please reach out to KifoPL#3358 - <@289119054130839552>`
			);
		return message.channel.send(embedreply).catch(() => { });
	}

	const contents = fs.readFileSync(`./commandList.json`);
	var jsonCmdList = JSON.parse(contents);

	if (args[0] == "help") {
		let x = args[0];
		args[0] = command;
		command = x;
	}

	try {
		if (command == "help") {
			const event = new Date(Date.now());
			main.log(
				`[Here](${message.url}) <@${message.author.id}> ${message.author.tag
				} issued \`${prefix}${command}\` in #${message.channel.name
				} at <t:${Math.floor(event.getTime() / 1000)}>, <t:${Math.floor(
					event.getTime() / 1000
				)}:R>.`
			);
			client.commands
				.get(command)
				.execute(message, args, prefix);
			return;
		} else if (command == "error") {
			const event = new Date(Date.now());
			main.log(
				`[Here](${message.url}) <@${message.author.id}> ${message.author.tag
				} issued \`${prefix}${command}\` in #${message.channel.name
				} at <t:${Math.floor(event.getTime() / 1000)}>, <t:${Math.floor(
					event.getTime() / 1000
				)}:R>.`
			);
			client.commands
				.get(command)
				.execute(message, args, Discord, client);
			return;
		} else if (command == "react") {
			const command2 = require(`./${jsonCmdList.react.path}`);
			const embedreactreply = new Discord.MessageEmbed();
			embedreactreply
				.setColor("a039a0")
				.setAuthor(
					"Powered by Kifo Clanker™",
					null,
					`https://discord.gg/HxUFQCxPFp`
				)
				.setTitle(
					`Command "${command.toUpperCase()}" issued by ${message.author.tag
					}`
				);
			if (
				!message.member
					.permissionsIn(message.channel)
					.has("MANAGE_CHANNELS")
			)
				return message.reply(
					kifo.embed("You do not have `MANAGE_CHANNELS` permissions.")
				);
			if (!args[0]) {
				con.query(
					"SELECT * FROM react WHERE ChannelId = ?",
					[message.channel.id],
					function (err, result) {
						if (err) throw err;
						if (result.length > 0) {
							embedreactreply.addField(
								"Warning:",
								"React is already **ON**!"
							);
							return message.reply(embedreactreply);
						} else {
							embedreactreply.addField(
								"React is **Off**.",
								`Syntax:\n${command2.usage.join("\n")}`
							);
							return message.reply(embedreactreply);
						}
					}
				);
				return;
			}
			const event = new Date(Date.now());
			main.log(
				`[Here](${message.url}) <@${message.author.id}> ${message.author.tag
				} issued \`${prefix}${command}\` in #${message.channel.name
				} at <t:${Math.floor(event.getTime() / 1000)}>, <t:${Math.floor(
					event.getTime() / 1000
				)}:R>.`
			);
			if (args[0].toUpperCase() == "LIST") {
				var FieldReactChannels = { name: "name", value: "description" };
				const newReactChannelsEmbed = new Discord.MessageEmbed()
					.setColor("a039a0")
					.setAuthor("Powered by Kifo Clanker™")
					.setTitle("List of channels, where command is active:");

				con.query(
					"SELECT ChannelId, GROUP_CONCAT(emote SEPARATOR ', ') AS emotes FROM react GROUP BY ChannelId ORDER BY ChannelId",
					function (err, result) {
						let guildChannels = [];
						result.forEach((row) => {
							if (
								message.guild.channels.resolve(row.ChannelId) !=
								null
							) {
								guildChannels.push(row);
							}
						});
						if (guildChannels.length > 0) {
							if (guildChannels.length < 25) {
								guildChannels.forEach((row) => {
									newReactChannelsEmbed.addField(
										`${row.emotes}`,
										`<#${row.ChannelId}>`
									);
								});
							} else {
								newReactChannelsEmbed.addField(
									`Channels:`,
									`<#${guildChannels
										.map((e) => e.ChannelId)
										.join(">, <#")}>`
								);
							}
						} else {
							newReactChannelsEmbed.addField(
								`INFO:`,
								`\`react\` is not enabled on your server yet.`
							);
						}
						return message.reply(newReactChannelsEmbed);
					}
				);
				return;
			}
			reactreturn = client.commands
				.get(command)
				.execute(message, args, Discord, client);
			if (reactreturn[0] == "ON") {
				let arrout = [];
				await reactreturn[1].forEach((emote) => {
					arrout.push([message.channel.id, emote]);
				});

				con.query(
					"INSERT INTO react (ChannelId, emote) VALUES ?",
					[arrout],
					function (err) {
						if (err) throw err;
					}
				);

				main.log(
					"I will now react in " +
					message.channel.name +
					" with " +
					arrout.map((e) => e[1]).join(", ")
				);
			} else if (reactreturn[0] == "OFF") {
				con.query(
					"DELETE FROM react WHERE ChannelId = ?",
					[message.channel.id],
					function (err) {
						if (err) throw err;
					}
				);
			}
			return;
		} else if (command == "superslow") {
			const embedsuperslowreply = new Discord.MessageEmbed();
			embedsuperslowreply
				.setColor("a039a0")
				.setAuthor(
					"Powered by Kifo Clanker™",
					null,
					`https://discord.gg/HxUFQCxPFp`
				)
				.setTitle(
					`Command "${command.toUpperCase()}" issued by ${message.author.tag
					}`
				);

			const commandfile = require(`./${jsonCmdList.superslow.path}`);
			if (
				!message.member
					.permissionsIn(message.channel)
					.has("MANAGE_CHANNELS")
			)
				return message.reply(
					kifo.embed("You do not have `MANAGE_CHANNELS` permissions.")
				);
			if (!args[0]) {
				con.query(
					"SELECT ChannelId, Time FROM superslow WHERE ChannelId = ?",
					[message.channel.id],
					function (err, result) {
						if (err) throw err;
						if (result.length > 0) {
							embedsuperslowreply
								.setTitle("Result:")
								.setDescription(
									"Super slow-mode is already set here to " +
									ms(ms(result[0].Time, { long: true }))
								);
							return message.reply(embedsuperslowreply);
						} else {
							embedsuperslowreply
								.setTitle(
									"Super slow-mode is **NOT** activated."
								)
								.setDescription(
									"Syntax:\n" + commandfile.usage.join("\n")
								);
							return message.reply(embedsuperslowreply);
						}
					}
				);
				//just in case
				return;
			}
			const event = new Date(Date.now());
			main.log(
				`[Here](${message.url}) <@${message.author.id}> ${message.author.tag
				} issued \`${prefix}${command}\` in #${message.channel.name
				} at <t:${Math.floor(event.getTime() / 1000)}>, <t:${Math.floor(
					event.getTime() / 1000
				)}:R>.`
			);
			if (args[0]?.toUpperCase() == "LIST") {
				var FieldReactChannels = { name: "name", value: "description" };
				const newSuperslowChannelsEmbed = new Discord.MessageEmbed()
					.setColor("a039a0")
					.setTitle("List of channels, where command is active:");
				con.query(
					"SELECT ChannelId, Time FROM superslow",
					function (err, result) {
						let guildChannels = [];
						result.forEach((row) => {
							if (
								message.guild.channels.resolve(row.ChannelId) !=
								null
							) {
								guildChannels.push(row);
							}
						});
						if (guildChannels.length > 0) {
							if (guildChannels.length < 25) {
								guildChannels.forEach((row) => {
									newSuperslowChannelsEmbed.addField(
										`${ms(row.Time, { long: true })}`,
										`<#${row.ChannelId}>`
									);
								});
							} else {
								newSuperslowChannelsEmbed.addField(
									`Channels:`,
									`<#${guildChannels
										.map((e) => e.ChannelId)
										.join(">, <#")}>`
								);
							}
						} else {
							newSuperslowChannelsEmbed.addField(
								`INFO:`,
								`\`superslow\` is not enabled on your server yet.`
							);
						}
						return message.reply(newSuperslowChannelsEmbed);
					}
				);
				return;
			}
			//[0] - isOff, [1] - ms(args[0])
			superslowreturn = client.commands
				.get(command)
				.execute(message, args, Discord, client);
			if (superslowreturn == null) return;
			//Just making sure lmao
			if (superslowreturn[0] == undefined) return;

			if (!superslowreturn[0]) {
				con.query(
					"SELECT ChannelId, time FROM superslow WHERE ChannelId = ?",
					[message.channel.id],
					function (err, result) {
						if (result.length > 0) {
							let timestamp = result[0].Time;
							if (timestamp == superslowreturn[1]) {
								embedsuperslowreply
									.setTitle("Result:")
									.setDescription(
										"it's already set to " +
										ms(superslowreturn[1], {
											long: true,
										}) +
										"!"
									);
								return message.reply(embedsuperslowreply);
							}
							con.query(
								"UPDATE superslow SET ChannelId = ?, Time = ? WHERE ChannelId = ?",
								[
									message.channel.id,
									superslowreturn[1],
									message.channel.id,
								],
								function (err) {
									if (err) throw err;
									embedsuperslowreply
										.setTitle("Result:")
										.setDescription(
											"Super slow-mode was already activated. It is now set to " +
											ms(superslowreturn[1], {
												long: true,
											})
										);
									return message.reply(embedsuperslowreply);
								}
							);
						} else {
							con.query(
								"INSERT INTO superslow ( ChannelId ,Time ) VALUES ( ?, ? );",
								[message.channel.id, superslowreturn[1]],
								function (err) {
									if (err) throw err;
									embedsuperslowreply
										.setTitle("Result:")
										.setDescription(
											"set Super slow-mode to " +
											ms(superslowreturn[1], {
												long: true,
											}) +
											"."
										);
									message.reply(embedsuperslowreply);
									//This is to notify users of Super slow-mode active in the channel.
									message.channel.setRateLimitPerUser(10);
									return;
								}
							);
						}
					}
				);
			} else if (superslowreturn[0]) {
				con.query(
					"DELETE FROM superslowusers WHERE ChannelId = ?",
					[message.channel.id],
					function (err) {
						if (err) throw err;
						con.query(
							"DELETE FROM superslow WHERE ChannelId = ?",
							[message.channel.id],
							function (err1) {
								if (err1) throw err1;
								embedsuperslowreply
									.setTitle("Result:")
									.setDescription(
										"Super slow-mode is successfully disabled."
									);
								message.reply(embedsuperslowreply);
								message.channel.setRateLimitPerUser(0);
								return;
							}
						);
					}
				);
			}
			return;
		} else {
			const event = new Date(Date.now());
			main.log(
				`[Here](${message.url}) <@${message.author.id}> ${message.author.tag
				} issued \`${prefix}${command}\` in #${message.channel.name
				} at <t:${Math.floor(event.getTime() / 1000)}>, <t:${Math.floor(
					event.getTime() / 1000
				)}:R>.`
			);
			try {
				debug = client.commands
					.get(command)
					.execute(message, args, prefix);
			} catch (error) {
				message.reply(kifo.embed(error, "Error!"));
				main.log(error);
			}
			return;
		}
	} catch (err) {
		message.reply(kifo.embed(err, "Error!"));
		main.log(err);
	}
}
async function onmessage(message) {
	const prefix = await main.prefix(message.guild?.id);
	react(message, prefix).catch(() => { });
	await superslow(message, prefix).catch(() => { });

	if (message.deleted) return;

	speakcheck = checks(message, prefix);

	if (speakcheck) {
		if (
			!message.content.toLowerCase().startsWith(prefix.toLowerCase()) ||
			message.author.bot
		)
			return;

		if (
			message.content
				.toLowerCase()
				.startsWith(prefix.toLowerCase().trim()) &&
			message.content.length > prefix.length
		) {
			commands(message, prefix);
			message.channel.stopTyping(true);
		}
	}
}

let debug;
let clientapp;
//that's @KifoPL#3358
let Owner;

const guildIdTest = "822800862581751848";

function setCommandList() {
	let cmdListJSON = "";
	let cmdListMD = `# List of Commands:\n> Remember to add server prefix before command syntax.\n\n`;
	const help = require("./help.js");
	cmdListMD += `### ${help.name}\n\n- ${help.description
		}\n- Usage:\n- ${help.usage.join("\n- ")}\n`;
	cmdListJSON += `{\n`;
	for (const folder of commandFolders) {
		cmdListMD += `## ${folder.toUpperCase()}\n\n`;
		const commandFiles = fs
			.readdirSync(`./commands/${folder}`)
			.filter((file) => file.endsWith(".js"));
		for (const file of commandFiles) {
			cmdListJSON += `"${file.slice(0, file.length - 3)}": {\n`;
			cmdListJSON += `\t"file": "${file}",\n`;
			cmdListJSON += `\t"path": "commands/${folder}/${file}",\n`;
			cmdListJSON += `\t"relativepath": "../${folder}/${file}"\n\t},\n`;

			const command = require(`./commands/${folder}/${file}`);
			cmdListMD += `### ${command.name}\n\n`;
			cmdListMD += `- ${command.description}\n`;
			cmdListMD += `- Usage:\n\t- ${command.usage.join("\n\t- ")}\n`;
			cmdListMD += `- Required user permissions: \`${command.perms.join(
				"`, `"
			)}\`\n`;
			cmdListMD += `\n`;
		}
	}
	let now = new Date(Date.now());
	cmdListJSON = cmdListJSON.slice(0, cmdListJSON.length - 2);
	cmdListJSON += `\n}`;
	cmdListMD += `<hr/>\n`;
	cmdListMD += `\n> - *Some commands may require additional perms for the bot.*`;
	cmdListMD += `\n> - *Last update: ${now.toUTCString()}*`;

	fs.writeFile(`commandList.json`, cmdListJSON, () => {
		return;
	});
	fs.writeFile(`commandList.md`, cmdListMD, () => {
		return;
	});
	console.log(`Created commandList.json file!`);
	console.log(`Created commandList.md file!`);
}

client.once("ready", () => {
	console.log("Kifo Clanker™ is online!");
	loadowner();
	setCommandList();
	debug = false;
	module.exports.client = client;

	//DELETING SLASH COMMANDS CODE FOR NOW, I tried using prebuilt API, but it was "too" prebuild and it didn't fit my bot at all. Will have to do stuff manually...

	//This line is executed by default, but I'm just making sure the status is online (other factors could change the status)
	updatePresence();
	setInterval(updatePresence, 1000 * 60 * 3);
	console.log("Presence set!");
	giveawayCheck();
	setInterval(giveawayCheck, 1000 * 60);
	removeCheck();
	setInterval(removeCheck, 1000 * 60);
	permsCheck();
	setInterval(permsCheck, 1000 * 60);
	menusCheck();
	setInterval(menusCheck, 1000 * 60);

	try {
		//for WoofWoofWolffe feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild
					.fetchInvites()
					.then((invites) => {
						WoofInviteCount = invites.find(
							(invite) =>
								invite.inviter.id == "376956266293231628"
						).uses;
					})
					.catch(() => { });
			})
			.catch(() => { });
		//for HaberJordan feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild
					.fetchInvites()
					.then((invites) => {
						HaberInviteCount = invites.find(
							(invite) =>
								invite.inviter.id == "221771499843878912"
						).uses;
					})
					.catch(() => { });
			})
			.catch(() => { });
		//for NumeralJoker feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild
					.fetchInvites()
					.then((invites) => {
						NumeralJokerCount = invites.find(
							(invite) =>
								invite.inviter.id == "285906871393452043"
						).uses;
					})
					.catch(() => { });
			})
			.catch(() => { });
		//for SWInsider feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild
					.fetchInvites()
					.then((invites) => {
						SWInsiderInviteCount = invites.find(
							(invite) =>
								invite.inviter.id == "813613441448804354"
						).uses;
					})
					.catch(() => { });
			})
			.catch(() => { });
		//for Shadow MilSim feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild
					.fetchInvites()
					.then((invites) => {
						ShadowInviteCount = invites.find(
							(invite) =>
								invite.inviter.id == "418938568543830033"
						).uses;
					})
					.catch(() => { });
			})
			.catch(() => { });
	} catch (err) {
		main.log(err);
	}
	con.query("SELECT * FROM menu_perms", [], function (err, result) {
		if (err) throw err;
		if (result.length > 0) {
			result.forEach((row) => {
				menus.set(row.MessageId, {
					MessageId: row.MessageId,
					ChannelId: row.ChannelId,
					GuildId: row.GuildId,
					isPerm: true,
					DestinationChannelId: row.DestinationChannelId,
					PermName: row.PermName,
				});
			});
		}
		console.log(`Mapped ${result.length} Perm Menus!`);
	});
	con.query("SELECT * FROM menu_roles", [], function (err, result) {
		if (err) throw err;
		if (result.length > 0) {
			result.forEach((row) => {
				menus.set(row.MessageId, {
					MessageId: row.MessageId,
					ChannelId: row.ChannelId,
					GuildId: row.GuildId,
					isPerm: false,
					RoleId: row.RoleId,
				});
			});
		}
		console.log(`Mapped ${result.length} Role Menus!`);
	});
});

function giveawayCheck() {
	let now = new Date(Date.now());
	con.query(
		"SELECT Id, MessageId, ChannelId, GuildId, UserId, Winners, EndTime, Reaction FROM giveaway WHERE EndTime <= ?",
		[now],
		function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				main.log(
					`${result.length} giveaway${result.length > 1 ? "s have" : " has"
					} ended!`
				);
				result.forEach(async (row) => {
					let link = `https://discord.com/channels/${row.GuildId}/${row.ChannelId}/${row.MessageId}`;
					let msg = {};
					await client.guilds
						.resolve(row.GuildId)
						.channels.resolve(row.ChannelId)
						.messages.fetch({ cache: true })
						.then((msgs) => {
							msg = msgs.get(row.MessageId);
						});
					if (msg == null)
						Owner.send(
							kifo.embed(`WARNING: ${link} giveaway not fetched.`)
						).catch((err) => {
							main.log(err);
						});
					if (msg.partial) {
						await msg.fetch().catch((err) => {
							main.log(err);
						});
					}
					let temp = {};
					await msg.reactions
						.resolve(row.Reaction)
						.users.fetch()
						.then((col) => {
							temp = col
								.filter((user) => !user.bot)
								.random(row.Winners + 1);
						})
						.catch((err) => {
							main.log(err);
						});
					let winners = temp;
					winners.shift();
					//generate a .txt file
					let output = "";
					let authorM = `<@!${row.UserId}>`;
					await winners.forEach((winner) => {
						if (winner != undefined) {
							output += `\n- <@${winner?.id ??
								" `not enough reactions to conclude, if that's not the case notify Kifo` <@289119054130839552> "
								}>`;
						}
						if (winner === null) main.log(winners);
					});

					const giveEmbed = new Discord.MessageEmbed()
						.setTitle("Giveaway results:")
						.setURL()
						.setAuthor(
							`Powered by Kifo Clanker™`,
							client.user.avatarURL({
								format: "png",
								dynamic: true,
								size: 64,
							})
						)
						.setColor("a039a0")
						.setFooter(
							"Giveaway ended at: " + row.EndTime.toUTCString()
						)
						.setThumbnail(
							client.guilds.resolve(row.GuildId)?.iconURL({
								format: "png",
								dynamic: true,
								size: 64,
							})
						);
					if (row.Winners > 25) {
						fs.writeFileSync(
							`./${row.MessageId}.txt`,
							output,
							() => { }
						);
						giveEmbed
							.attachFiles([
								{
									attachment: `./${row.MessageId}.txt`,
									name: `${row.MessageId}.txt`,
								},
							])
							.setDescription("Results are in .txt file!");
					} else giveEmbed.setDescription(output);
					await client.channels
						.resolve(row.ChannelId)
						.send(authorM, giveEmbed)
						.catch(async () => {
							await client.guilds
								.resolve(row.GuildID)
								.members.resolve(row.UserId)
								.send(
									`${authorM} couldn't send results in <#${row.ChannelId}>!`,
									giveEmbed
								)
								.catch(async () => {
									await Owner.send(
										`Can't send giveaway info at Server ${client.guilds.resolve(row.GuildID)
											.name
										}, Channel ${client.channels.resolve(
											row.ChannelId
										).name
										}. Server owner: <@${client.guilds.resolve(row.GuildID)
											.ownerID
										}>`,
										giveEmbed
									).catch((err) => {
										main.log(err);
									});
								});
						});
					try {
						fs.unlink(`./${row.MessageId}.txt`, () => { });
					} catch (err) { }
				});
				con.query(
					"DELETE FROM giveaway WHERE EndTime <= ?",
					[now],
					function (err1) {
						if (err1) throw err1;
					}
				);
			}
		}
	);
}

function removeCheck() {
	let now = new Date(Date.now());
	con.query(
		"SELECT Id, UserId, RoleId, PerpetratorId, ChannelId, GuildId, EndTime FROM role_remove WHERE EndTime <= ?",
		[now],
		function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				main.log(
					`${result.length} remove${result.length > 1 ? "s" : ""
					} found!`
				);
				result.forEach(async (row) => {
					let member = {};
					await client.guilds
						.resolve(row.GuildId)
						.members.resolve(row.UserId)
						.fetch()
						.then((user) => {
							member = user;
						});
					let channel = client.guilds
						.resolve(row.GuildId)
						.channels.resolve(row.ChannelId);
					member.roles
						.add(row.RoleId)
						.then(() => {
							channel
								.send(
									`<@!${member.id}>, <@!${row.PerpetratorId}>`,
									kifo.embed(
										`Issued by: <@!${row.PerpetratorId}>\nRole added: <@&${row.RoleId}>\nTo: <@!${member.id}>`,
										`Role remove command (role readded)`
									)
								)
								.catch((err1) => {
									client.guilds
										.resolve(row.GuildId)
										.members.resolve(row.PerpetratorId)
										.send(
											kifo.embed(
												`Issued by: <@!${row.PerpetratorId}>\nRole added: <@&${row.RoleId}>\nTo: <@!${member.id}>`,
												`Role remove command (role readded)`
											)
										)
										.catch(() => { });
									main.log(err1);
								});
						})
						.catch((err1) => {
							channel
								.send(
									`<@!${member.id}>, <@!${row.PerpetratorId}>`,
									kifo.embed(
										`Issued by: <@!${row.PerpetratorId}>\nRole added: <@&${row.RoleId}>\nTo: <@!${member.id}>`,
										`UNABLE TO ADD ROLE BACK`
									)
								)
								.catch((err2) => {
									client.guilds
										.resolve(row.GuildId)
										.members.resolve(row.PerpetratorId)
										.send(
											kifo.embed(
												`Issued by: <@!${row.PerpetratorId}>\nRole added: <@&${row.RoleId}>\nTo: <@!${member.id}>`,
												`UNABLE TO ADD ROLE BACK`
											)
										)
										.catch(() => { });
									main.log(err2);
								});
							main.log(err1);
						});
				});
				con.query(
					"DELETE FROM role_remove WHERE EndTime <= ?",
					[now],
					function (err1) {
						if (err1) throw err1;
					}
				);
			}
		}
	);
}

function permsCheck() {
	let now = new Date(Date.now());
	con.query(
		"SELECT Id, PerpetratorId, MessageId, ChannelId, GuildId, PermId, PermFlag, EndTime, Command FROM perms WHERE EndTime <= ?",
		[now],
		function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				main.log(
					`${result.length} perm${result.length > 1 ? "s" : ""
					} found!`
				);
				let previousMap = new Map();
				let failureMap = new Map();
				result.forEach(async (row) => {
					if (failureMap.has(row.MessageId)) return;
					let Current = client.guilds
						.resolve(row.GuildId)
						?.channels.resolve(row.ChannelId)
						?.permissionOverwrites.get(row.PermId)
						?.allow.has(row.PermFlag)
						? "allow"
						: client.guilds
							.resolve(row.GuildId)
							?.channels.resolve(row.ChannelId)
							?.permissionOverwrites.get(row.PermId)
							?.deny.has(row.PermFlag)
							? "deny"
							: "neutral";
					//a map for output message for each message (cmd)
					if (!previousMap.has(row.MessageId)) {
						previousMap.set(row.MessageId, Current);
					}
					client.guilds
						.resolve(row.GuildId)
						?.channels.resolve(row.ChannelId)
						?.updateOverwrite(row.PermId, {
							[row.PermFlag]:
								row.Command == "add"
									? true
									: row.Command == "rm"
										? null
										: false,
						})
						// .then(() => {
						// 	//client.channels.resolve(row.ChannelId)?.send(kifo.embed(`Changed ${row.PermFlag} from ${Current} to ${row.Command} for ${client.guilds.resolve(row.GuildId)?.members.resolve(row.PermId) != null ? "<@!" : "<@&"}${row.PermId}>.`, "Changed back perms")).catch((err) => {main.log(err)})
						// })
						.catch((err) => {
							failureMap.set(row.MessageId, true);
							client.channels
								.resolve(row.ChannelId)
								?.send(
									`<@!${row.PerpetratorId}>`,
									kifo.embed(
										err,
										"Could not revert perms command!"
									)
								)
								.catch((err) => {
									main.log(err);
								});
						});
				});
				previousMap.forEach((value, key) => {
					//apparently return only stops the CURRENT callback function, each iteration of for each loop is a separate function.
					if (failureMap.has(key)) return;
					let Output = result.filter((row) => row.MessageId == key);
					let r = Output[0];
					let Title = `Changed ${r.PermFlag} from ${value} to ${r.Command == "add"
						? "allow"
						: r.Command == "rm"
							? "neutral"
							: "deny"
						} for:\n`;
					let Description = "";
					Output.forEach((rr) => {
						Description += `- <@${client.guilds
							.resolve(rr.GuildId)
							?.members.resolve(rr.PermId) != null
							? "!"
							: "&"
							}${rr.PermId}>\n`;
					});
					client.channels
						.resolve(r.ChannelId)
						?.send(
							`<@!${r.PerpetratorId}>`,
							kifo.embed(Description, Title)
						)
						.catch((err) => {
							main.log(err);
							client.guilds
								.resolve(r.GuildId)
								?.members.resolve(r.PerpetratorId)
								?.send(kifo.embed(Description, Title))
								.catch((err) => {
									main.log(err);
								});
						});
				});
				con.query(
					"DELETE FROM perms WHERE EndTime <= ?",
					[now],
					function (err1) {
						if (err1) throw err1;
					}
				);
			}
		}
	);
}

function menusCheck() {
	let now = new Date(Date.now());
	con.query(
		"SELECT Id, GuildId, ChannelId, CmdMsgId, CmdChId, MessageId, PermName, EndDate, StartDate, DestinationChannelId FROM menu_perms WHERE EndDate <= ?",
		[now],
		function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				result.forEach(async (row) => {
					let msg = await client.guilds
						.resolve(row.GuildId)
						.channels?.resolve(row.CmdChId)
						.messages?.fetch(row.CmdMsgId);
					let menu = await client.guilds
						.resolve(row.GuildId)
						.channels?.resolve(row.CmdChId)
						.messages?.fetch(row.MessageId);
					client.commands
						.get("menu")
						.revert(
							msg,
							menu,
							true,
							client.guilds
								.resolve(row.GuildId)
								.channels?.resolve(row.ChannelId),
							row.PermName
						);
				});
				main.log(`${result.length} perm menus found!`);
			}
		}
	);
	con.query(
		"SELECT Id, GuildId, ChannelId, MessageId, RoleId, EndDate, StartDate, CmdMsgId, CmdChId FROM menu_roles WHERE EndDate <= ?",
		[now],
		function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				result.forEach(async (row) => {
					let msg = await client.guilds
						.resolve(row.GuildId)
						.channels?.resolve(row.CmdChId)
						.messages?.fetch(row.CmdMsgId);
					let menu = await client.guilds
						.resolve(row.GuildId)
						.channels?.resolve(row.CmdChId)
						.messages?.fetch(row.MessageId);
					client.commands
						.get("menu")
						.revert(
							msg,
							menu,
							false,
							client.guilds
								.resolve(row.GuildId)
								.roles?.resolve(row.RoleId)
						);
				});
				main.log(`${result.length} role menus found!`);
			}
		}
	);
}

function updatePresence() {
	client.user.setStatus("online");
	client.user.setActivity({
		name: `Type "!kifo" to interact with me! I'm online for ${ms(
			client.uptime,
			{ long: true }
		)}.`,
		type: "PLAYING",
	});
}

//USED BY REACT COMMAND
let reactreturn;

client.on("message", (message) => {
	//this allows me to 1. catch stuff and 2. use async
	onmessage(message).catch((err) => {
		main.log(err);
	});
});

client.on("messageDelete", (message) => {
	try {
		if (menus.has(message.id)) {
			if (menus.get(message.id).isPerm) {
				client.commands.get("menu")
					.revert(message, message, menus.get(message.id).isPerm, message.guild.channels.resolve(menus.get(message.id).DestinationChannelId), menus.get(message.id).PermName)
			}
			else {
				client.commands.get("menu").revert(message, message, menus.get(message.id).isPerm, message.guild.roles.resolve(menus.get(message.id).RoleId))
			}
		}
	} catch (error) {
		main.log(error)
	}

})

client.on("messageDeleteBulk", (messages) => {
	messages.filter(msg => menus.has(msg.id)).each(message => {
		if (menus.has(message.id)) {
			if (menus.get(message.id).isPerm) {
				client.commands.get("menu")
					.revert(message, message, menus.get(message.id).isPerm, message.guild.channels.resolve(menus.get(message.id).DestinationChannelId), menus.get(message.id).PermName)
			}
			else {
				client.commands.get("menu").revert(message, message, menus.get(message.id).isPerm, message.guild.roles.resolve(menus.get(message.id).RoleId))
			}
		}
	})
})

//USED BY TODO COMMAND
client.on("messageReactionAdd", async (msgReaction, user) => {
	let msg = msgReaction.message;
	if (msg.partial) {
		await msg.fetch().catch(() => { });
	}
	if (user.partial) {
		await user.fetch().catch(() => { });
	}
	if (
		msg.channel.type == "dm" &&
		msg.author.bot &&
		!msgReaction.me &&
		msg.embeds[0]?.author?.name == `TODO`
	) {
		msg.delete().catch(() => { });
	} else if (menus.has(msg.id) && !user.bot) {
		let menu = menus.get(msg.id);
		if (menu.isPerm) {
			let channel = msg.guild?.channels.resolve(
				menu.DestinationChannelId
			);
			//If someone has specifically denied perms, they shouldn't be able to use the menu
			if (channel.permissionOverwrites.get(user.id)?.deny.has(menu.PermName)) return;
			channel
				.updateOverwrite(user.id, {
					[menu.PermName]: true,
				})
				.then(() => {
					user.send(
						kifo.embed(
							`You now have <:GreenCheck:857976926941478923> \`${menu.PermName}\` in <#${menu.DestinationChannelId}>!`
						)
					).catch(() => { });
				})
				.catch((err) => {
					main.log(err);
					msg.reply(
						kifo.embed(
							`Could not give \`${menu.PermName}\` for <@!${user.id}>!\n${err.message}`
						)
					);
				});
		} else {
			let role = msg.guild?.roles.resolve(menu.RoleId);
			let member = msg.guild?.members.resolve(user.id);
			if (member != undefined) {
				member.roles
					.add(menu.RoleId, "Used Role Menu!")
					.then(() =>
						member
							.send(
								kifo.embed(
									`Gave you ${role.name} role! (ID: ${menu.RoleId})`
								)
							)
							.catch(() => { })
					)
					.catch((err) => {
						msg.reply(
							kifo.embed(
								`Could not give <@&${menu.RoleId}> to <@!${user.id}>!\n${err.message}`
							)
						).catch(() => { });
					});
			}
		}
	}
});

client.on("messageReactionRemove", async (msgReaction, user) => {
	let msg = msgReaction.message;
	if (msg.partial) {
		await msg.fetch().catch(() => { });
	}
	if (user.partial) {
		await user.fetch().catch(() => { });
	}
	if (menus.has(msg.id) && !user.bot) {
		let menu = menus.get(msg.id);
		if (menu.isPerm) {
			let channel = msg.guild?.channels.resolve(
				menu.DestinationChannelId
			);
			channel
				.updateOverwrite(user.id, {
					[menu.PermName]: null,
				})
				.then(() => {
					user.send(
						kifo.embed(
							`Set <:GreySlash:857976926445502505> \`${menu.PermName}\` in <#${menu.DestinationChannelId}>!`
						)
					).catch(() => { });
				})
				.catch((err) => {
					main.log(err);
					msg.reply(
						kifo.embed(
							`Could not remove \`${menu.PermName}\` for <@!${user.id}>!\n${err.message}`
						)
					);
				});
		} else {
			let role = msg.guild?.roles.resolve(menu.RoleId);
			let member = msg.guild?.members.resolve(user.id);
			if (member != undefined) {
				member.roles
					.remove(menu.RoleId, "Used Role Menu!")
					.then(() =>
						member
							.send(
								kifo.embed(
									`Removed ${role.name} role! (ID: ${menu.RoleId})`
								)
							)
							.catch(() => { })
					)
					.catch((err) => {
						msg.reply(
							kifo.embed(
								`Could not remove <@&${menu.RoleId}> from <@!${user.id}>!\n${err.message}`
							)
						).catch(() => { });
					});
			}
		}
	}
});

//Code for adding special roles for ppl invited by partners
let WoofInviteCount;
let HaberInviteCount;
let NumeralJokerCount;
let SWInsiderInviteCount;
let ShadowInviteCount;

client.on("guildMemberAdd", (member) => {
	if (member.guild.id == "698075892974354482")
		member.guild
			.fetchInvites()
			.then((invites) => {
				//WoofWoof
				if (
					invites.find(
						(invite) => invite.inviter?.id == "376956266293231628"
					)?.uses ==
					WoofInviteCount + 1
				) {
					member.roles
						.add(
							member.guild.roles.cache.find(
								(role) => role.id == "746558695139180625"
							)
						)
						.catch(console.error);
					WoofInviteCount++;
				}
				//HaberJordan
				else if (
					invites.find(
						(invite) => invite.inviter?.id == "221771499843878912"
					)?.uses ==
					HaberInviteCount + 1
				) {
					member.roles
						.add(
							member.guild.roles.cache.find(
								(role) => role.id == "744082967307092039"
							)
						)
						.catch(console.error);
					HaberInviteCount++;
				}
				//SW Insider
				else if (
					invites.find(
						(invite) => invite.inviter?.id == "813613441448804354"
					)?.uses ==
					SWInsiderInviteCount + 1
				) {
					member.roles
						.add(
							member.guild.roles.cache.find(
								(role) => role.id == "858056136045756486"
							)
						)
						.catch(console.error);
					SWInsiderInviteCount++;
				}
				//Shadow Republic MilSim
				else if (
					invites.find(
						(invite) => invite.inviter?.id == "418938568543830033"
					)?.uses ==
					SWInsiderInviteCount + 1
				) {
					member.roles
						.add(
							member.guild.roles.cache.find(
								(role) => role.id == "867145484191399956"
							)
						)
						.catch(console.error);
					SWInsiderInviteCount++;
				}
				//NumeralJoker
				else if (
					invites.find(
						(invite) => invite.inviter?.id == "285906871393452043"
					)?.uses ==
					NumeralJokerCount + 1
				) {
					member.roles
						.add(
							member.guild.roles.cache.find(
								(role) => role.id == "844594877885972480"
							)
						)
						.catch(console.error);
					NumeralJokerCount++;

					let msg = `Welcome <@${member.id}>! Fill out this form to gain access to all of **NumeralJoker's <@285906871393452043> edits!!** in <#844667201888714813>\n\
				[https://forms.google.com/](https://forms.gle/3FkJQxMijEE32Eot9)\n\n\
				**__Once you are granted access__** you can find them via this link: https://drive.google.com/drive/shared-drives`;

					member.user
						.send(
							kifo.embed(
								msg,
								"Start your journey to find the Trove:"
							)
						)
						.catch(() => {
							member.guild.channels
								.resolve("844667201888714813")
								.send(
									`<@${member.id}>`,
									kifo.embed(
										msg,
										"Start your journey to find the Trove:"
									)
								);
						});
				}
			})
			.catch((err) => { main.log(err) });
});
//kifo-advanced-logs
client.on("guildCreate", async (guild) => {
	let date = new Date(Date.now());
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("863769411700785152");
	const embed = new Discord.MessageEmbed()
		.setColor("a039a0")
		.setThumbnail(guild.iconURL({ dynamic: true }))
		.setTitle("New Server!")
		.addField("Server Name", guild.name, true)
		.addField("Server ID", guild.id, true)
		.addField("Owner", `<@${guild.ownerID}>`, true)
		.addField("Member Count", guild.memberCount, true)
		.setFooter("Joined at: " + date.toUTCString());

	channel.send(embed).catch((err) => {
		main.log(err);
	});
});
//kifo-advanced-logs
client.on("guildDelete", (guild) => {
	let date = new Date(Date.now());
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("863769411700785152");
	const embed = new Discord.MessageEmbed()
		.setColor("a039a0")
		.setThumbnail(guild.iconURL({ dynamic: true }))
		.setTitle("Removed from a server :(")
		.addField("Server Name", guild.name, true)
		.addField("Server ID", guild.id, true)
		.addField("Owner", `<@${guild.ownerID}>`, true)
		.addField("Member Count", guild.memberCount, true)
		.setFooter("Left at: " + date.toUTCString());

	channel.send(embed).catch((err) => {
		main.log(err);
	});
});
//kifo-logs
client.on("error", (err) => {
	main.log(err);
});
//kifo-logs
client.on("warn", (info) => {
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("864112365896466432");
	return channel.send(kifo.embed(`${info}`, "WARNING")).catch((err) => {
		main.log(err);
	});
});
//kifo-advanced-logs
client.on("guildUnavailable", (guild) => {
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels("863769411700785152");
	channel
		.send(
			kifo.embed(
				`A guild "${guild.name}", ID ${guild.id}, Owner: <@${guild.ownerID}>, ${guild.owner.tag} has become unavailable!`
			)
		)
		.catch((err) => {
			main.log(err);
		});
});

/**
 *
 * @param {string} guildID the ID of the guild you want to get prefix for.
 * @returns prefix for the guild (default "!kifo ")
 */
exports.prefix = async function (guildID) {
	if (client.user.id == "796447999747948584") return "!ktest ";
	if (prefixes.has(guildID)) return prefixes.get(guildID);
	return "!kifo ";
};

/**
 * Logs in #kifo-logs
 * @param {string} log the message you want to log
 * @returns Promise, in case something breaks
 */
exports.log = function (log, ...args) {
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("864112365896466432");

	if (log instanceof Error) {
		const now = new Date(Date.now());
		return channel
			.send(
				`<@!289119054130839552>`,
				kifo.embed(
					`${log.stack}\n\nAt <t:${Math.floor(
						now.getTime() / 1000
					)}>, <t:${Math.floor(
						now.getTime() / 1000
					)}:R>\nOther args: ${args.join(" ")}`,
					`CRITICAL ERROR`
				)
			)
			.catch((err) => console.log(err));
	}
	return channel
		.send(kifo.embed(`${log} ${args.join(" ")}`, "LOG"))
		.catch((err) => {
			main.log(err);
		});
};

client.login(process.env.LOGIN_TOKEN);

process.on('uncaughtException', async (err) => {
	console.error(err)
	await main.log(err)
	process.exit(1);
})