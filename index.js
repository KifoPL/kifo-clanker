//libraries
const Discord = require("discord.js");
require("dotenv")?.config();
const fs = require("fs");
const ms = require("ms");
const kifo = require("kifo");
const main = require(`./index.js`);
//const prefix = `${process.env.PREFIX} `;

//TEMPLATE EMBED

// // const embedreply = new Discord.MessageEmbed();
// // embedreply.setColor('a039a0')
// // .setAuthor("Powered by Kifo Clanker™", null, `https://discord.gg/HxUFQCxPFp`)
// // .setTitle(`Command ${this.name} issued by ${message.author.tag}`)

//client login
const client = new Discord.Client({
	partials: [`MESSAGE`, `CHANNEL`, `REACTION`],
});
//Owner is Discord User @KifoPL#3358 - <@289119054130839552>
async function loadowner() {
	clientapp = await client.fetchApplication().catch(() => {});
	Owner = clientapp.owner;
	console.log("Bot owner object loaded!");
}

//OLD DATABASE CONNECTION
// const db = require("redis").createClient(process.env.REDIS_URL);
// db.on("connect", function () {
// 	console.log("Database online!");
// });

//DATABASE CONNECTION
const mysql = require("mysql");
const prefixes = new Map();
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
			console.log(err);
			Owner?.send(kifo.embed(err, "Error:")).catch(() => {});
			setTimeout(dbReconnect, 3000);
		}
		console.log(`Connected to ${process.env.HOST} MySQL DB!`);
		module.exports = { con };

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
		console.log(err);
		Owner?.send(kifo.embed(err, "Error:")).catch(() => {});
		if (err.code === "PROTOCOL_CONNECTION_LOST") {
			dbReconnect();
		} else {
			Owner?.send(kifo.embed(err, "Error BOT IS SHUT DOWN:")).catch(
				() => {}
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
		message.channel.startTyping().catch(() => {});
		const event = new Date(Date.now());
		console.log(
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
				"https://discord.com/api/oauth2/authorize?client_id=795638549730295820&permissions=76824&scope=applications.commands%20bot"
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
				`try ${prefix}help`,
				"This will list all commands available to you (you can see more commands if you're an Admin)!"
			)
			.addField(
				"\u200B",
				"This bot is developed by [KifoPL](https://github.com/KifoPL).\nDiscord: <@289119054130839552> : @KifoPL#3358\nReddit: [u/kifopl](http://reddit.com/u/kifopl)\n[Buy me a beer!](https://www.buymeacoffee.com/kifoPL) (developing bot takes a lot of time, by donating you help me pay my electricity / internet bills!)"
			);
		message.channel.send(helloEmbed);
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
	// db.exists("RT" + message.channel.id, function (err, reply) {
	// 	if (reply === 1) {
	// 		if (!message.content.startsWith(prefix)) {
	// 			//It will react to his own messages that have attachments, this is so #kenoc-hall-of-fame looks better
	// 			if (message.author.id != client.user.id) {
	// 				if (message.author.bot) return;
	// 			} else {
	// 				if (message.embeds[0] == null) return;
	// 			}
	// 			if (
	// 				!message.guild.me
	// 					.permissionsIn(message.channel)
	// 					.has("ADD_REACTIONS")
	// 			) {
	// 				const embedreply = new Discord.MessageEmbed();
	// 				embedreply
	// 					.setColor("a039a0")
	// 					.setAuthor(
	// 						"Powered by Kifo Clanker™",
	// 						null,
	// 						`https://discord.gg/HxUFQCxPFp`
	// 					)
	// 					.setTitle(
	// 						"Missing `ADD_REACTIONS` permission. Please turn off `react` module in this channel, or enable `ADD_REACTIONS` for me."
	// 					);
	// 				return message.reply(embedreply);
	// 			}
	// 			db.lrange(
	// 				"RT" + message.channel.id,
	// 				0,
	// 				-1,
	// 				function (err, reply) {
	// 					for (i = 0; i < reply.length; i++) {
	// 						if (message.deleted) return;
	// 						message.react(reply[i]).catch(() => {});
	// 						var eventRT = new Date(Date.now());
	// 					}
	// 					console.log(
	// 						"Reacted in " +
	// 							message.guild.name +
	// 							", " +
	// 							message.channel.name +
	// 							" at " +
	// 							eventRT.toUTCString()
	// 					);
	// 				}
	// 			);
	// 		}
	// 	}
	// });
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
						message.react(row.emote).catch(() => {});
					});
					console.log(
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
	// db.exists("SM" + message.channel.id, function (err, reply) {
	// 	if (reply === 1) {
	// 		if (
	// 			!message.guild.me
	// 				.permissionsIn(message.channel)
	// 				.has("MANAGE_CHANNELS")
	// 		) {
	// 			const embedreply = new Discord.MessageEmbed();
	// 			embedreply
	// 				.setColor("a039a0")
	// 				.setAuthor(
	// 					"Powered by Kifo Clanker™",
	// 					null,
	// 					`https://discord.gg/HxUFQCxPFp`
	// 				)
	// 				.setTitle(
	// 					"Missing `MANAGE_CHANNELS` permission. Please turn off `superslow` module in this channel, or enable `MANAGE_CHANNELS` for me."
	// 				);
	// 			return message.reply(embedreply);
	// 		}
	// 		if (
	// 			!message.guild.me
	// 				.permissionsIn(message.channel)
	// 				.has("MANAGE_MESSAGES")
	// 		) {
	// 			const embedreply = new Discord.MessageEmbed();
	// 			embedreply
	// 				.setColor("a039a0")
	// 				.setAuthor(
	// 					"Powered by Kifo Clanker™",
	// 					null,
	// 					`https://discord.gg/HxUFQCxPFp`
	// 				)
	// 				.setTitle(
	// 					"Missing `MANAGE_MESSAGES` permission. Please turn off `superslow` module in this channel, or enable `MANAGE_MESSAGES` for me."
	// 				);
	// 			return message.reply(embedreply);
	// 		}

	// 		if (!message.member.permissions.has("ADMINISTRATOR")) {
	// 			let slowmode;
	// 			db.hget(
	// 				"SM" + message.channel.id,
	// 				"time",
	// 				function (err, reply2) {
	// 					slowmode = reply2;
	// 				}
	// 			);
	// 			if (slowmode == 0) return;
	// 			db.hexists(
	// 				"SM" + message.channel.id,
	// 				message.author.id,
	// 				function (err, reply2) {
	// 					if (reply2 === 1) {
	// 						db.hget(
	// 							"SM" + message.channel.id,
	// 							message.author.id,
	// 							async function (err, reply3) {
	// 								if (
	// 									message.createdTimestamp - reply3 <=
	// 									slowmode
	// 								) {
	// 									if (
	// 										message.content.trim() ==
	// 										prefix.trim()
	// 									) {
	// 										message.author
	// 											.send(
	// 												`You can't talk in ${
	// 													message.channel.name
	// 												} yet, please wait another ${ms(
	// 													slowmode -
	// 														(message.createdTimestamp -
	// 															reply3),
	// 													{ long: true }
	// 												)}.`
	// 											)
	// 											.catch(() => {});
	// 										await message
	// 											.delete()
	// 											.catch(() => {});
	// 										return;
	// 									} else {
	// 										//I'm not kidding this msg works, because apparently subtraction forces integer type ¯\_(ツ)_/¯
	// 										let msg =
	// 											"You can't talk in " +
	// 											message.channel.name +
	// 											" for **" +
	// 											ms(
	// 												slowmode -
	// 													(message.createdTimestamp -
	// 														reply3),
	// 												{
	// 													long: true,
	// 												}
	// 											) +
	// 											"**. You can check, if you can talk (without risking waiting another " +
	// 											ms(
	// 												slowmode -
	// 													(message.createdTimestamp -
	// 														reply3) +
	// 													(message.createdTimestamp -
	// 														reply3),
	// 												{ long: true }
	// 											) +
	// 											"), by typing **" +
	// 											prefix.trim() +
	// 											"**.";
	// 										message.author
	// 											.send(msg)
	// 											.catch(() => {});
	// 										await message
	// 											.delete()
	// 											.catch(() => {});
	// 										return;
	// 									}
	// 								} else {
	// 									if (
	// 										message.content.trim() ==
	// 										prefix.trim()
	// 									) {
	// 										message.author
	// 											.send(
	// 												`You can already talk in #${message.channel.name}.`
	// 											)
	// 											.catch(() => {});
	// 										await message
	// 											.delete()
	// 											.catch(() => {});
	// 										return;
	// 									} else
	// 										db.hset(
	// 											"SM" + message.channel.id,
	// 											message.author.id,
	// 											message.createdTimestamp
	// 										);
	// 								}
	// 							}
	// 						);
	// 					} else {
	// 						db.hset(
	// 							"SM" + message.channel.id,
	// 							message.author.id,
	// 							message.createdTimestamp
	// 						);
	// 					}
	// 				}
	// 			);
	// 		}
	// 	}
	// });
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
							// console.log(`${slowmode}, ${result2}`);
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
												`You can't talk in ${
													message.channel.name
												} yet, please wait another ${ms(
													slowmode -
														(message.createdTimestamp -
															result2[0]
																.timestamp),
													{ long: true }
												)}.`
											)
											.catch(() => {});
										await message.delete().catch(() => {});
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
											.catch(() => {});
										await message.delete().catch(() => {});
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
											.catch(() => {});
										await message.delete().catch(() => {});
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
										.catch(() => {});
									await message.delete().catch(() => {});
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
				await hello(message, prefix).catch(() => {});
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
			console.log(`msg: ${message.content}`);
			message.reply(
				kifo.embed("Only KifoPL#3358 and testers can use this bot.")
			);
			return false;
		}

	// //Perms beggar, only enters second "If" if first is true, the most optimized way to beg for perms I came up with
	// if (!message.guild?.me.permissions.has("ADMINISTRATOR"))
	// 	if (message.content.startsWith(prefix) && !message.author.bot) {
	// 		message.reply(
	// 			"until I have time to calculate all permissions for individual commands, this bot requires Admin to work."
	// 		);
	// 		return false;
	// 	}

	if (!message.guild?.me.permissionsIn(message.channel).has("SEND_MESSAGES"))
		return false;

	return true;
}
async function commands(message, prefix) {
	//If command detected, create args struct
	const args = message.content.slice(prefix.length).split(/ +/);
	const command = args.shift().toLowerCase();

	//var debug = "false";
	// db.get("debug", function (err, reply) {
	// 	debug = reply;
	// });

	if (command == "serverlist" && message.author == Owner) {
		console.log("run SERVERLIST command");
		let serversarr = [];
		let serverembed = new Discord.MessageEmbed();
		await message.client.guilds.cache.each((guild) => {
			serversarr.push({
				name: guild.name,
				value: `<:owner:823658022785908737> ${guild.owner.user.tag}, ${
					guild.memberCount
				} members. ${
					guild.available
						? "<:online:823658022974521414>"
						: "<:offline:823658022957613076> OUTAGE!"
				}`,
			});
		});
		serverembed
			.addFields(serversarr)
			.setTitle("Server list:")
			.setFooter(
				`I am in ${serversarr.length} servers as of ${new Date(
					Date.now()
				).toUTCString()}`
			)
			.setColor("a039a0");
		message.channel.send(serverembed).catch(() => {});
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
		return message.channel.send(embedreply);
	}

	const contents = fs.readFileSync(`./commandList.json`);
	var jsonCmdList = JSON.parse(contents);

	if (command == "help") {
		const event = new Date(Date.now());
		console.log(
			message.author.tag,
			"issued !kifo",
			command,
			"in",
			message.channel.name,
			"at",
			event.toUTCString()
		);
		client.commands.get(command).execute(message, args, Discord, prefix);
		return;
	} else if (command == "error") {
		const event = new Date(Date.now());
		console.log(
			message.author.tag,
			"issued !kifo",
			command,
			"in",
			message.channel.name,
			"at",
			message.guild.name,
			"at",
			event.toUTCString()
		);
		client.commands.get(command).execute(message, args, Discord, client);
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
				`Command "${command.toUpperCase()}" issued by ${
					message.author.tag
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
			// db.exists("RT" + message.channel.id, function (err, reply) {
			// 	if (reply === 1) {
			// 		db.hget(
			// 			"RT" + message.channel.id,
			// 			"time",
			// 			function (err, reply2) {
			// 				embedreactreply.addField(
			// 					"Warning:",
			// 					"React is already **ON**!"
			// 				);
			// 				return message.reply(embedreactreply);
			// 			}
			// 		);
			// 	} else {
			// 		embedreactreply.addField(
			// 			"React is **Off**.",
			// 			`Syntax:\n${command2.usage.join("\n")}`
			// 		);
			// 		return message.reply(embedreactreply);
			// 	}
			// });
			//just in case
			return;
		}
		const event = new Date(Date.now());
		console.log(
			message.author.tag,
			"issued !kifo",
			command,
			"in",
			message.channel.name,
			"at",
			message.guild.name,
			"at",
			event.toUTCString()
		);
		if (args[0].toUpperCase() == "LIST") {
			var FieldReactChannels = { name: "name", value: "description" };
			const newReactChannelsEmbed = new Discord.MessageEmbed()
				.setColor("a039a0")
				.setAuthor("Powered by Kifo Clanker™")
				.setTitle("List of channels, where command is active:");
			// await message.guild.channels.cache
			// 	.each(async (channel) => {
			// 		await db.exists(
			// 			"RT" + channel.id,
			// 			async function (err, reply) {
			// 				if (reply === 1) {
			// 					await db.lrange(
			// 						"RT" + channel.id,
			// 						0,
			// 						-1,
			// 						async function (err, reply) {
			// 							await message.channel.send(
			// 								"<#" + channel.id + ">: " + reply
			// 							); //TODO fix it someday
			// 							newReactChannelsEmbed.addField(
			// 								`#${channel.name}`,
			// 								`${reply}`
			// 							);
			// 							//console.log(`1 ${newReactChannelsEmbed.fields.toString()}`)
			// 						}
			// 					);
			// 					//console.log(`2 ${newReactChannelsEmbed.fields.toString()}`)
			// 				}
			// 			}
			// 		);
			// 	})
			// 	.then(message.channel.send(newReactChannelsEmbed));

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
			//console.log(newReactChannelsEmbed);
			//message.channel.send(newReactChannelsEmbed);
			//message.channel.send("End of list!");
			return;
		}
		reactreturn = client.commands
			.get(command)
			.execute(message, args, Discord, client);
		if (reactreturn[0] == "ON") {
			//channellist.set(message.channel.id, message.channel);
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

			// for (i = 0; i < arrout.length; i++) {

			// 	db.rpush(
			// 		["RT" + message.channel.id, arrout[i]],
			// 		function (err, reply) {}
			// 	);
			// }
			console.log(
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
			// //channellist.delete(message.channel.id);
			// db.del("RT" + message.channel.id);
		}
		return;
	} else if (command == "superslow") {
		//DB structure:
		// "SM" + channel id
		// {
		//     time: ms(time)
		//     userid: timestamp
		//     userid: timestamp
		// }

		const embedsuperslowreply = new Discord.MessageEmbed();
		embedsuperslowreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(
				`Command "${command.toUpperCase()}" issued by ${
					message.author.tag
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
			// db.exists("SM" + message.channel.id, function (err, reply) {
			// 	if (reply === 1) {
			// 		db.hget(
			// 			"SM" + message.channel.id,
			// 			"time",
			// 			function (err, reply2) {
			// 				embedsuperslowreply
			// 					.setTitle("Result:")
			// 					.setDescription(
			// 						"Super slow-mode is already set here to " +
			// 							ms(ms(reply2, { long: true }))
			// 					);
			// 				return message.reply(embedsuperslowreply);
			// 			}
			// 		);
			// 	} else {
			// 		embedsuperslowreply
			// 			.setTitle("Super slow-mode is **NOT** activated.")
			// 			.setDescription(
			// 				"Syntax:\n" + commandfile.usage.join("\n")
			// 			);
			// 		return message.reply(embedsuperslowreply);
			// 	}
			// });
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
							.setTitle("Super slow-mode is **NOT** activated.")
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
		console.log(
			message.author.tag,
			"issued !kifo",
			command,
			"in",
			message.channel.name,
			"at",
			message.guild.name,
			"at",
			event.toUTCString()
		);
		if (args[0]?.toUpperCase() == "LIST") {
			var FieldReactChannels = { name: "name", value: "description" };
			const newSuperslowChannelsEmbed = new Discord.MessageEmbed()
				.setColor("a039a0")
				.setTitle("List of channels, where command is active:");
			// message.guild.channels.cache.each((channel) => {
			// 	db.exists("SM" + channel.id, function (err, reply) {
			// 		if (reply === 1) {
			// 			db.hget(
			// 				"SM" + channel.id,
			// 				"time",
			// 				function (err, reply2) {
			// 					message.channel.send(
			// 						"<#" +
			// 							channel.id +
			// 							">: " +
			// 							ms(ms(reply2, { long: true }))
			// 					); //TODO fix it someday
			// 				}
			// 			);
			// 			var FieldReactChannels = {};
			// 			FieldReactChannels.name = "#" + channel.name;
			// 			FieldReactChannels.value = "Super slow-mode ON.";
			// 			newSuperslowChannelsEmbed.addField(
			// 				FieldReactChannels.name,
			// 				FieldReactChannels.value
			// 			);
			// 			//console.log(newReactChannelsEmbed.fields);
			// 		}
			// 	});
			// });
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

			//console.log(newReactChannelsEmbed);
			// message.channel.send("End of list!");
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
			// db.hexists(
			// 	"SM" + message.channel.id,
			// 	"time",
			// 	function (err, reply) {
			// 		if (reply === 1) {
			// 			db.hget(
			// 				"SM" + message.channel.id,
			// 				"time",
			// 				function (err, timestamp) {
			// 					if (timestamp == superslowreturn[1]) {
			// 						embedsuperslowreply
			// 							.setTitle("Result:")
			// 							.setDescription(
			// 								"it's already set to " +
			// 									ms(superslowreturn[1], {
			// 										long: true,
			// 									}) +
			// 									"!"
			// 							);
			// 						return message.reply(embedsuperslowreply);
			// 					}
			// 					db.hset(
			// 						"SM" + message.channel.id,
			// 						"time",
			// 						superslowreturn[1]
			// 					);
			// 					embedsuperslowreply
			// 						.setTitle("Result:")
			// 						.setDescription(
			// 							"Super slow-mode was already activated. It is now set to " +
			// 								ms(superslowreturn[1], {
			// 									long: true,
			// 								})
			// 						);
			// 					return message.reply(embedsuperslowreply);
			// 				}
			// 			);
			// 		} else {
			// 			db.hmset("SM" + message.channel.id, {
			// 				time: superslowreturn[1],
			// 			});
			// 			embedsuperslowreply
			// 				.setTitle("Result:")
			// 				.setDescription(
			// 					"set Super slow-mode to " +
			// 						ms(superslowreturn[1], { long: true }) +
			// 						"."
			// 				);
			// 			message.reply(embedsuperslowreply);
			// 			//This is to notify users of Super slow-mode active in the channel.
			// 			message.channel.setRateLimitPerUser(10);
			// 			return;
			// 		}
			// 	}
			// );
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
			// db.hexists(
			// 	"SM" + message.channel.id,
			// 	"time",
			// 	function (err, reply) {
			// 		if (reply === 1) {
			// 			db.del("SM" + message.channel.id);
			// 			embedsuperslowreply
			// 				.setTitle("Result:")
			// 				.setDescription(
			// 					"Super slow-mode is successfully disabled."
			// 				);
			// 			message.reply(embedsuperslowreply);
			// 			message.channel.setRateLimitPerUser(0);
			// 		} else
			// 			embedsuperslowreply
			// 				.setTitle("Result:")
			// 				.setDescription(
			// 					"this channel does not have super slow-mode. Maybe you already deleted it?"
			// 				);
			// 		return message.reply(embedsuperslowreply);
			// 	}
			// );
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
		console.log(
			message.author.tag,
			"issued !kifo",
			command,
			"in",
			message.channel.name,
			"at",
			message.guild.name,
			"at",
			event.toUTCString()
		);
		debug = client.commands
			.get(command)
			.execute(message, args, Discord, prefix);
		return;
	}
}
async function onmessage(message) {
	const prefix = await main.prefix(message.guild?.id);
	react(message, prefix).catch(() => {});
	await superslow(message, prefix).catch(() => {});

	if (message.deleted) return;

	speakcheck = checks(message, prefix);

	if (speakcheck) {
		if (
			!message.content.toLowerCase().startsWith(prefix.toLowerCase()) ||
			message.author.bot
		)
			return;

		//No role and @here and @everyone pings
		// if (message.mentions.roles.firstKey() != undefined)
		// 	return message.reply(kifo.embed("no roles in commands!"));
		// if (message.mentions.everyone)
		// 	return message.reply(kifo.embed("don't even try pinging..."));

		if (
			message.content
				.toLowerCase()
				.startsWith(prefix.toLowerCase().trim()) &&
			message.content.length > prefix.length
		)
			commands(message, prefix);
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
	cmdListMD += `### ${help.name}\n\n- ${
		help.description
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
			cmdListMD += `- Required user permissions: ${command.perms.join(
				", "
			)}\n`;
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

	try {
		//for WoofWoofWolffe feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild.fetchInvites().then((invites) => {
					WoofInviteCount = invites.find(
						(invite) => invite.inviter.id == "376956266293231628"
					).uses;
				});
			})
			.catch(() => {});
		//for HaberJordan feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild.fetchInvites().then((invites) => {
					HaberInviteCount = invites.find(
						(invite) => invite.inviter.id == "221771499843878912"
					).uses;
				});
			})
			.catch(() => {});
		//for NumeralJoker feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild.fetchInvites().then((invites) => {
					NumeralJokerCount = invites.find(
						(invite) => invite.inviter.id == "285906871393452043"
					).uses;
				});
			})
			.catch(() => {});
		//for SWInsider feature
		client.guilds
			.fetch("698075892974354482")
			.then((guild) => {
				guild.fetchInvites().then((invites) => {
					SWInsiderInviteCount = invites.find(
						(invite) => invite.inviter.id == "813613441448804354"
					).uses;
				});
			})
			.catch(() => {});
	} catch (err) {
		console.log(err);
	}
});

function giveawayCheck() {
	let now = new Date(Date.now());
	con.query(
		"SELECT Id, MessageId, ChannelId, GuildId, UserId, Winners, EndTime, Reaction FROM giveaway WHERE EndTime <= ?",
		[now],
		function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				console.log(
					`${result.length} giveaway${
						result.length > 1 ? "s have" : " has"
					} ended!`
				);
				result.forEach(async (row) => {
					let msg = {};
					await client.guilds
						.resolve(row.GuildId)
						.channels.resolve(row.ChannelId)
						.messages.fetch({ cache: true })
						.then((msgs) => {
							msg = msgs.get(row.MessageId);
						});
					if (msg.partial) {
						await msg.fetch().catch((err) => console.log(err));
					}
					let temp = {};
					await msg.reactions
						.resolve(row.Reaction)
						.users.fetch()
						.then((col) => {
							temp = col
								.filter((user) => !user.bot)
								.random(row.Winners);
						})
						.catch((err) => console.log(err));
					let winners = temp.length > 1 ? temp : [temp];
					let output = "";
					await winners.forEach((winner) => {
						if (winner != undefined) {
							output += `\n- <@${
								winner?.id ??
								" `not enough reactions to conclude, if that's not the case notify Kifo` <@289119054130839552> "
							}>`;
						}
						if (winner === null) console.log(winners)
					});
					const giveEmbed = new Discord.MessageEmbed()
					.setTitle("Giveaway results:")
					.setURL(`https://discord.com/channels/${row.GuildId}/${row.ChannelId}/${row.MessageId}`)
					.setAuthor(`<:KifoClanker:822925174885449738> Powered by Kifo Clanker™`)
					.setColor("a039a0")
					.setDescription(output)
					.setFooter("Giveaway ended at: " + row.EndTime.toUTCString())
					.setThumbnail(client.guilds.resolve(row.GuildId)?.iconURL({
							format: "png",
							dynamic: true,
							size: 64,
						}))
					client.channels
						.resolve(row.ChannelId)
						.send(giveEmbed)
						.catch(() => {
							client.guilds
								.resolve(row.GuildID)
								.members.resolve(row.UserId)
								.send(giveEmbed)
								.catch(() => {
									Owner.send(
										`Can't send giveaway info at Server ${
											client.guilds.resolve(row.GuildID)
												.name
										}, Channel ${
											client.channels.resolve(
												row.ChannelId
											).name
										}. Server owner: <@${
											client.guilds.resolve(row.GuildID)
												.ownerID
										}>`,
										giveEmbed
									).catch((err) => console.log(err));
								});
						});
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
		console.log(err);
	});
});

//USED BY TODO COMMAND
client.on("messageReactionAdd", async (msgReaction) => {
	let msg = msgReaction.message;
	if (msg.partial) {
		await msg.fetch().catch(() => {});
	}
	if (
		msg.channel.type == "dm" &&
		msg.author.bot &&
		!msgReaction.me &&
		msg.embeds[0]?.author?.name == `TODO`
	) {
		msg.delete().catch(() => {});
	} else return;
});

//Code for adding special roles for ppl invited by partners
let WoofInviteCount;
let HaberInviteCount;
let NumeralJokerCount;
let SWInsiderInviteCount;

client.on("guildMemberAdd", (member) => {
	member.guild
		.fetchInvites()
		.then((invites) => {
			//WoofWoof
			if (
				invites.find(
					(invite) => invite.inviter.id == "376956266293231628"
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
					(invite) => invite.inviter.id == "221771499843878912"
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
			} else if (
				invites.find(
					(invite) => invite.inviter.id == "813613441448804354"
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
			//NumeralJoker
			else if (
				invites.find(
					(invite) => invite.inviter.id == "285906871393452043"
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
						kifo.embed(msg, "Start your journey to find the Trove:")
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
		.catch(console.error);
});

client.on("guildCreate", async (guild) => {
	let date = new Date(Date.now());
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("822800863050858539");
	const embed = new Discord.MessageEmbed()
		.setColor("a039a0")
		.setThumbnail(guild.iconURL({ dynamic: true }))
		.setTitle("New Server!")
		.addField("Server Name", guild.name, true)
		.addField("Server ID", guild.id, true)
		.addField("Owner", `<@${guild.ownerID}>`, true)
		.addField("Member Count", guild.memberCount, true)
		.setFooter("Joined at: " + date.toUTCString());

	channel.send(embed).catch((err) => console.log(err));
});

/**
 *
 * @param {string} guildID the ID of the guild you want to get prefix for.
 * @returns prefix for the guild (default "!kifo ")
 */
exports.prefix = async function (guildID) {
	if (prefixes.has(guildID)) return prefixes.get(guildID);
	return "!kifo ";
};

client.login(process.env.LOGIN_TOKEN);
