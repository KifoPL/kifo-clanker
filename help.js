module.exports = {
	name: "help",
	description:
		"This command lists all categories of commands.\nType !kifo help <command> to see help for a specific command.\nType !kifo help <category> to see list of commands for a specific category.",
	usage: "!kifo help <optional_command_or_category>",
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, Discord) {
		const fs = require("fs");
		const client = message.client;

		commandList = new Discord.Collection();

		let command = {};
		var AmIAdmin = false;
		if (message.member.permissions.has("ADMINISTRATOR")) AmIAdmin = true;

		const commandFolders = fs.readdirSync("./commands");
		for (const folder of commandFolders) {
			const commandFiles = fs
				.readdirSync(`./commands/${folder}`)
				.filter((file) => file.endsWith(".js"));
			for (const file of commandFiles) {
				const command = require(`./commands/${folder}/${file}`);
				commandList.set(command.name, {
					command: command,
					folder: folder,
				});
				//console.log(file);
			}
		}

		//!kifo help <arg>
		if (args[0]) {
			//!kifo help help
			if (args[0] == "help") {
				const newEmbed = new Discord.MessageEmbed()
					.setColor("a039a0")
					.setTitle(args[0])
					.setDescription(this.description)
					.addField("Usage:", this.usage)
					.addField("Required permissions:", this.perms.join(", "));
				message.channel.send(newEmbed);
				return;
			}
			//!kifo help <command>
			if (commandList.has(args[0])) {
				const command = commandList.get(args[0]).command;
				const newEmbed = new Discord.MessageEmbed()
					.setColor("a039a0")
					.setTitle(command.name)
					.setDescription(command.description)
					.addField("Usage:", command.usage)
					.addField(
						"Required permissions:",
						command.perms.join(", ")
					);
				message.channel.send(newEmbed);
				return;
			} else {
				//!kifo help <category>
				if (commandFolders.includes(args[0].toLowerCase())) {
					var Field = { name: "name", value: "description" };
					var FieldArr = [];
					let i = 1;
					commandList
						.filter((cmd) => cmd.folder == args[0].toLowerCase())
						.each((cmd) => {
							var Field = {};
							Field.name = cmd.command.name;
							Field.value = `${cmd.folder}: ${cmd.command.description}`;
							FieldArr.push(Field);
							i++;
						});
					var Field = {};
					Field.name = this.name;
					Field.value = this.description;
					FieldArr.push(Field);
					const newEmbed = new Discord.MessageEmbed()
						.setColor("a039a0")
						.setTitle("List of " + i + " commands, by KifoPL:")
						.setFooter(
							`Bot is created and developed solely by KifoPL#3358 - <@289119054130839552>. Click on the title to get an invite to bot's Discord server.`
						)
						.setURL("https://discord.gg/HxUFQCxPFp")
						.addFields(FieldArr);

					return message.channel.send(newEmbed);
				}
				const embedreply = new Discord.MessageEmbed();
				embedreply
					.setColor("a039a0")
					.setAuthor(
						"Powered by Kifo Clanker™",
						null,
						`https://discord.gg/HxUFQCxPFp`
					)
					.setTitle(
						`Command ${this.name} issued by ${message.author.tag}`
					)
					.addField(
						`Command ${command} not found.`,
						`Run ${prefix.trim()} help to get list of available commands.`
					);
				return message.channel.send(embedreply);
			}
		}
		//!kifo help
		var Field = { name: "name", value: "description" };
		var FieldArr = [];
		Field.name = this.name;
		Field.value = this.description;
		//key - category name, value - amount of commands
		FieldArr.push(Field);
		const FolderCollection = new Discord.Collection();

		var commandCount = 0;
		commandList.each((cmd) => {
			if (FolderCollection.has(cmd.folder)) {
				FolderCollection.set(cmd.folder, {
					folder: cmd.folder,
					value: FolderCollection.get(cmd.folder).value + 1,
				});
			} else {
				FolderCollection.set(cmd.folder, {
					folder: cmd.folder,
					value: 1,
				});
			}
			commandCount++;
		});

		var Field = {};
		let CategoryCount = 0;
		FolderCollection.sort((x, y) => x.folder - y.folder).each(
			(cmdObject, categoryName) => {
				var Field = {};
				Field.name = `__${categoryName.toUpperCase()}__`;
				let cmdListString = "";
				commandList
					.filter((cmd) => cmd.folder == categoryName)
					.each((cmd) => {
						cmdListString += `**${cmd.command.name}**, `;
					});
				cmdListString.trimRight();
				cmdListString =
					cmdListString.slice(0, cmdListString.length - 2) + ".";
				Field.value = `This category has **${cmdObject.value}** commands: ${cmdListString}`;
				FieldArr.push(Field);
				CategoryCount++;
			}
		);
		// for (const file of commandList) {
		// 	const command = require(`./commands/${file}`);
		// 	//Lists everything for admins and only user accessible commands otherwise.
		// 	if (!command.adminonly || AmIAdmin) {
		// 		var Field = {};
		// 		Field.name = command.name;
		// 		Field.value = command.description;
		// 		FieldArr.push(Field);
		// 		i++;
		// 	}
		// }
		const newEmbed = new Discord.MessageEmbed()
			.setColor("a039a0")
			.setTitle(
				`List of ${commandCount} commands in ${CategoryCount} categories, by KifoPL:`
			)
			.setDescription(
				`Type !kifo help <category> to get detailed list of commands, or !kifo help <command> to get help for that command.`
			)
			.setURL("https://discord.gg/HxUFQCxPFp")
			.setFooter(
				`Bot is created and developed solely by KifoPL#3358 - <@289119054130839552>. Click on the title to get an invite to bot's Discord server.`
			)
			.addFields(FieldArr);

		message.channel.send(newEmbed);
	},
};
