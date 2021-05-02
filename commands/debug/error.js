module.exports = {
	name: "error",
	description: `If this bot encountered an error anywhere, please type this command right after. It will ping me (KifoPL#3358).\nWARNING! If you spam this command for no reason, you will get warned on the same premise as spam pinging. Use only when encountering actual errors.`,
	usage: "kifo error <optional_description>",
	adminonly: false,
	async execute(message, args, Discord, client) {
		const clientapp = await client.fetchApplication();

		const embedreply = new Discord.MessageEmbed();
		embedreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(
				`Command "${this.name.toUpperCase()}" issued by ${
					message.author.tag
				}`
			);
		let reply =
			"**" + message.author.username + "** has encountered a problem.";
		let kiforeply =
			reply +
			` Link: https://discord.com/channels/${message.channel.guild.id}/${message.channel.id}/${message.id}`;
		reply += " Kifo has been notified, he will reply soon™.";
		if (args[0]) {
			embedreply.addField(
				"**" +
					message.author.username +
					"** has encountered a problem.",
				`Problem: ${args.join(" ")}`
			);
			let problem = "\nProblem:\n> *" + args.join(" ") + "*";
			//reply += problem;
			kiforeply += problem;
		} else
			embedreply.addField(
				"**" +
					message.author.username +
					"** has encountered a problem.",
				`No description provided.`
			);

		message.channel.send(embedreply).catch();
		const embedkiforeply = embedreply;
		embedkiforeply.setURL(
			`https://discord.com/channels/${message.channel.guild.id}/${message.channel.id}/${message.id}`
		);
		clientapp.owner.send(embedkiforeply).catch();
		//clientApp.owner.send(reply);
	},
};
