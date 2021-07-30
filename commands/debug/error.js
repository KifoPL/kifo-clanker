const Discord = require("discord.js");
const { Octokit } = require("@octokit/rest")
const octokit = new Octokit({
	auth: process.env.GITHUB_KEY
})
const owner = "KifoPL";
const repo = "kifo-clanker";
const main = require(`../../index.js`)
const kifo = require("kifo")
module.exports = {
	name: "error",
	description: `If this bot encountered an error anywhere, please type this command right after. It will ping me (KifoPL#3358) and automatically create an issue on [GitHub](https://github.com/KifoPL/kifo-clanker/issues).\nWARNING! If you spam this command for no reason, you will get warned on the same premise as spam pinging. Use only when encountering actual errors.`,
	usage: ["`error <description>` - pings <@289119054130839552> with provided description and creates an issue on [GitHub](https://github.com/KifoPL/kifo-clanker/issues)."],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	async execute(message, args) {
		const clientapp = await message.client.application.fetch();
		const embedreply = new Discord.MessageEmbed();
		embedreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(
				`Command "${this.name.toUpperCase()}" issued by ${message.author.tag
				}`
			);
		let reply =
			`**<@${message.author.username}>** has encountered a problem in <#${message.channel.id}>, ${message.guild.name} server.`;
		let kiforeply =
			reply +
			` Link: https://discord.com/channels/${message.channel.guild.id}/${message.channel.id}/${message.id}`;
		reply += " Kifo has been notified, he will reply soon™.";
		if (!args[0]) message.reply({ embeds: [kifo.embed("Please provide a description to the error!")] })
		if (args[0]) {
			embedreply.addField(
				"**" +
				message.author.username +
				"** has encountered a problem.",
				`Problem: ${args.join(" ")}`
			);
			let problem = "\n## Problem description:\n\n" + args.join(" ");
			kiforeply += problem;
		} else
			embedreply.addField(
				"**" +
				message.author.username +
				"** has encountered a problem.",
				`No description provided.`
			);

		let title = args.join(" ");
		if (title.length > 50) title = title.slice(0, 50) + "...";

		octokit.issues.create({
			owner: owner,
			repo: repo,
			title: title,
			body: kiforeply,
			labels: ["error"],
			assignee: "KifoPL",
		}).then(response => {
			let url = response.data.html_url;
			embedreply.addField("An issue on GitHub has been created!", `Please [comment on an issue](${url}) to provide a more detailed description of the error.\n\n__**It's a good idea to describe:**__\n1. What did trigger this error?\n2. Did the bot crash (became offline), or was he still operational?\n3. Do you know a potential fix?`)
			message.reply({ embeds: [embedreply] }).catch();
			const embedkiforeply = embedreply;
			embedkiforeply.setURL(
				`https://discord.com/channels/${message.channel.guild.id}/${message.channel.id}/${message.id}`
			);
			clientapp.owner.send({ embeds: [embedkiforeply] }).catch();
		}).catch(err => main.log(err))
	},
};
