const Discord = require("discord.js");
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({
	auth: process.env.GITHUB_KEY,
});
const owner = "KifoPL";
const repo = "kifo-clanker";
const main = require(`src/index`);
const kifo = require("kifo");
module.exports = {
	name: "error",
	description: `Creates an issue on GitHub and pings KifoPL. Do not spam this command.`,
	options: [
		{
			name: "description",
			type: "STRING",
			description:
				"Provide a brief description of how and when this error occurred.",
			required: true,
		},
	],
	usage: [
		"`error <description>` - pings <@289119054130839552> with provided description and creates an issue on [GitHub](https://github.com/KifoPL/kifo-clanker/issues).",
	],
	category: "DEBUG",
	guildonly: false,
	perms: ["USE_APPLICATION_COMMANDS"],
	async execute(itr) {
		await itr.deferReply();
		const desc = itr.options.data.find(
			(o) => o.name === "description"
		).value;
		const itrReply = await itr.fetchReply();
		const clientapp = await itr.client.application.fetch();
		const embedreply = new Discord.MessageEmbed();
		embedreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(
				`Command "${this.name.toUpperCase()}" issued by ${itr.user.tag}`
			);
		let reply = `**<@${itr.user.id}>** has encountered a problem in <#${
			itr.channelId
		}>, ${itr.guild?.name ?? ""}.`;
		let kiforeply = reply + ` Link: ${itrReply.url}`;
		reply += " Kifo has been notified, he will reply soon™.";
		embedreply.addField(
			"**" + itr.user.username + "** has encountered a problem.",
			`Problem: ${desc}`
		);
		let problem = "\n## Problem description:\n\n" + desc;
		kiforeply += problem;

		let title = desc;
		if (title.length > 50) title = title.slice(0, 50) + "...";

		octokit.issues
			.create({
				owner: owner,
				repo: repo,
				title: title,
				body: kiforeply,
				labels: ["error"],
				assignee: "KifoPL",
			})
			.then((response) => {
				let url = response.data.html_url;
				embedreply.addField(
					"An issue on GitHub has been created!",
					`Please [comment on an issue](${url}) to provide a more detailed description of the error.\n\n__**It's a good idea to describe:**__\n1. What did trigger this error?\n2. Did the bot crash (became offline), or was he still operational?\n3. Do you know a potential fix?`
				);
				itr.editReply({ embeds: [embedreply] }).catch();
				const embedkiforeply = embedreply;
				embedkiforeply.setURL(itrReply.url);
				clientapp.owner.send({ embeds: [embedkiforeply] }).catch();
			})
			.catch((err) => main.log(err));
	},
};
