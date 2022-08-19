const kifo = require("kifo");
const Discord = require("discord.js");
const fs = require("fs");
const https = require("https");

const cmdPaths = require("../../commandList.json");
const list = require(`../${cmdPaths.list.path}`);

module.exports = {
	name: "user stats",
	description: "Lists user stats.",
	type: "USER",
	guildonly: true,
	category: "MANAGEMENT",
	perms: ["USE_APPLICATION_COMMANDS"],

	//itr = interaction
	execute: execute,

	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};

async function execute(itr) {
	await itr.deferReply({ ephemeral: true });
	let member = itr.options.getMember("user");
	let embed = member.user.bot
		? await list.botstats(itr, member, false)
		: await list.userstats(itr, member, false);

	itr.editReply({ embeds: [embed] });
}
