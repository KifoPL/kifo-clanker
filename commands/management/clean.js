const Discord = require("discord.js");
const kifo = require("kifo")
const main = require("../../index.js")
const fs = require("fs")




module.exports = {
	name: "clean",
	description: "This command cleans any permission overwrites that don't have `DENY` (<:RedX:857976926542757910>) or `ALLOW` (<:GreenCheck:857976926941478923>).",
	usage: [
		"`clean` - cleans permission overwrites in the current channel.",
		"`clean <channel>` - cleans permission overwrites in `channel`.",
		"`clean <category>` - clean permission overwrites for `category` and all channels in `category`",
		"`clean all` - clean permission overwrites for `all` channels in the server."
	],
	adminonly: false,
	perms: ["SEND_MESSAGES", "MANAGE_CHANNELS", "MANAGE_ROLES"],
	execute: execute,
	cleanChannel: cleanChannel,
	cleanPerms: cleanPerms,
};

async function cleanChannel(message, channel, callback) {

	//PERM CHECK
	if (!message.member.permissionsIn(message.channel).has("MANAGE_CHANNELS")) {
		callback(new Error("You don't have `MANAGE_CHANNELS` permission!"), { isSuccess: false })
		return;
	}
	if (!message.member.permissionsIn(message.channel).has("MANAGE_ROLES")) {
		callback(new Error("You don't have `MANAGE_ROLES` permission!"), { isSuccess: false })
		return;
	}
	if (!message.guild.me?.permissionsIn(message.channel).has("MANAGE_ROLES")) {
		callback(new Error("I don't have `MANAGE_ROLES` permission!"), { isSuccess: false })
		return;
	}

	try {
		await channel.permissionOverwrites.each(async (permOver) => {
			await cleanPerms(message, permOver, function (err, result) {
				if (err) throw err;
			})
		})
		callback(undefined, { isSuccess: true })
	} catch (error) {
		callback(error, { isSuccess: false })
	}

}
async function cleanPerms(message, permOver, callback) {
	if (permOver.allow.toArray().length === 0 && permOver.deny.toArray().length === 0) {
		await permOver.delete()//${message.author.tag}`)
			.then((permOver) => {
				callback(undefined, { isSuccess: true })
			})
			.catch(err => {
				message.reply(`Could not delete permission overwrite!\n${err}`, "Error!")
				main.log(err)
				callback(err, { isSuccess: false })
			})
	}
	callback(undefined, { isSuccess: true })
}

async function execute(message, args) {

	let channelsToClean = 0;
	let channelsCleaned = 0;
	let channelsErrors = 0;
	let channel = {};

	let outputMsg = `Channel Id\tName\tStatus\tError\n`
	//!kifo clean
	if (!args[0]) {
		channelsToClean = 1;
		channel = message.channel;
		await cleanChannel(message, channel, function (err, result) {
			result.isSuccess ? channelsCleaned++ : channelsErrors++
			outputMsg += `${channel.id}\t${channel.name}\t${result.isSuccess ? "Success" : `Error\t${err.message}`}\n`
		})
	}
	//!kifo clean args[0]
	else if (!args[1]) {
		//!kifo clean all
		if (args[0].toLowerCase() == "all") {
			if (!message.member.permissions.has("ADMINISTRATOR")) return message.reply(kifo.embed("You don't have `ADMINISTRATOR` permissions!"))
			await message.guild.fetch().then(guild => guild.channels.cache.each(async (ch) => {
				channelsToClean++;
				await cleanChannel(message, ch, function (err, result) {
					result.isSuccess ? channelsCleaned++ : channelsErrors++
					outputMsg += `${ch.id}\t${ch.name}\t${result.isSuccess ? "Success" : `Error\t${err.message}`}\n`
				});
			})).catch(err => main.log(err))
		}
		else {
			//!kifo clean channel
			if (args[0].match(Discord.MessageMentions.CHANNELS_PATTERN)) {
				//<#222>
				channel = message.guild.channels.resolve(args[0].slice(2, -1))
			} else channel = message.guild.channels.resolve(args[0])
			if (channel == null) {
				return message.reply(kifo.embed("Invalid channel!")).catch(() => { })
			}
			if (channel.type === "category") {
				channelsToClean++;
				await cleanChannel(message, channel, function (err, result) {
					result.isSuccess ? channelsCleaned++ : channelsErrors++
					outputMsg += `${channel.id}\t${channel.name}\t${result.isSuccess ? "Success" : `Error\t${err.message}`}\n`
				})
				await message.guild.fetch().then(guild => guild.channels.cache.filter(ch => ch.parent == channel).each(async (ch) => {
					channelsToClean++;
					await cleanChannel(message, ch, function (err, result) {
						result.isSuccess ? channelsCleaned++ : channelsErrors++
						outputMsg += `${ch.id}\t${ch.name}\t${result.isSuccess ? "Success" : `Error\t${err.message}`}\n`
					});
				}))
			}
		}
	} else return message.reply(kifo.embed("Invalid syntax!")).catch(() => { })

	fs.writeFileSync(`./clean${message.id}.txt`, outputMsg, () => { })
	let embed = kifo.embed(`Channels Found: ${channelsToClean}, channels cleaned: ${channelsCleaned}, errors: ${channelsErrors}`)
	embed.attachFiles(`./clean${message.id}.txt`, `clean${message.id}.txt`)
	await message.channel.send(embed).catch((err) => console.error(err))

	try {
		fs.unlinkSync(`./clean${message.id}.txt`, (err) => { if (err) main.log(err) })
	} catch (er1) {
		main.log(er1)
	}
}