const kifo = require('kifo');
const Discord = require('discord.js')
module.exports = {
	name: "help",
	description:
		"This command lists all categories of commands and shows help for every command.",
	usage: [
		"`help` - lists all available commands",
		"`help <category>` - lists all commands for a specific category",
		"`help <command>` - shows help for specific command",
		"`<command> help` - shows help for specific command",
	],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, prefix) {
		const fs = require("fs");
		const client = message.client;

		commandList = new Discord.Collection();

		let command = {};
		var AmIAdmin = false;
		if (message.member.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR)) AmIAdmin = true;

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
			}
		}

		//help <arg>
		if (args[0]) {
			//help help
			if (args[0] == "help") {
				const newEmbed = new Discord.MessageEmbed()
					.setColor("a039a0")
					.setTitle(args[0])
					.setDescription(this.description)
					.addField("Usage:", this.usage.join("\n"))
					.addField("Required permissions:", this.perms.join(", "));
				message.reply({ embeds: [newEmbed] });
				return;
			}
			//help <command>
			if (commandList.has(args[0])) {
				const command = commandList.get(args[0]).command;
				const newEmbed = new Discord.MessageEmbed()
					.setColor("a039a0")
					.setTitle(command.name)
					.setDescription(command.description)
					.addField("Usage:", command.usage.join("\n"))
					.addField(
						"Required permissions:",
						command.perms.join(", ")
					);
				message.reply({ embeds: [newEmbed] });
				return;
			} else {
				//help <category>
				if (commandFolders.includes(args[0].toLowerCase())) {
					var Field = { name: "name", value: "description" };
					var FieldArr = [];
					let i = 1;
					commandList
						.filter((cmd) => cmd.folder == args[0].toLowerCase())
						.each((cmd) => {
							if (
								cmd.command.perms.every((perm) =>
									message.member
										.permissionsIn(message.channel)
										.toArray()
										.includes(perm)
								)
							) {
								var Field = {};
								Field.name = cmd.command.name;
								Field.value = `${cmd.command.description}`;
								FieldArr.push(Field);
								i++;
							}
						});
					var Field = {};
					Field.name = this.name;
					Field.value = this.description;
					FieldArr.push(Field);
					const newEmbed = new Discord.MessageEmbed()
						.setColor("a039a0")
						.setTitle("List of " + i + " commands, by KifoPL:")
						.setFooter(
							`Bot is created and developed solely by KifoPL#3358 - <@289119054130839552>. Click on the title to get full list of commands.`
						)
						.setURL(
							"https://kifopl.github.io/kifo-clanker/docs/commandList"
						)
						.addFields(FieldArr);

					return message.reply({ embeds: [newEmbed] });
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
						`Command ${args[0]} not found.`,
						`Run \`${prefix.trim()} help\` to get list of available commands.`
					);
				return message.reply({ embeds: [embedreply] });
			}
		}
		//help
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
						if (
							cmd.command.perms.every((perm) =>
								message.member
									.permissionsIn(message.channel)
									.toArray()
									.includes(perm)
							)
						) {
							cmdListString += `**${cmd.command.name}**, `;
						}
						else
						{
							cmdListString += `~~*${cmd.command.name}*~~, `;
						}
					});
				cmdListString.trimRight();
				cmdListString =
					cmdListString.slice(0, cmdListString.length - 2) + ".";
				Field.value = `This category has **${cmdObject.value}** commands: ${cmdListString}`;
				FieldArr.push(Field);
				CategoryCount++;
			}
		);
		const newEmbed = new Discord.MessageEmbed()
			.setColor("a039a0")
			.setTitle(
				`List of ${commandCount} commands in ${CategoryCount} categories, by KifoPL:`
			)
			.setDescription(
				`**Click on the text above** for full and detailed list of commands.\nType \`${prefix}help <category>\` to get detailed list of commands within a category, or \`${prefix}help <command>\` to get help for that command.\n\nIf a command is ~~crossed out~~, you have insufficient perms to run it.\n\n*Looking for \`/\` commands? Run \`/guide Slash commands\`, or click [here](https://kifopl.github.io/kifo-clanker/docs/commandList#list-of-slash-commands-used-with-).*`
			)
			.setURL("https://kifopl.github.io/kifo-clanker/docs/commandList")
			.setFooter(
				`Bot is created and developed solely by KifoPL#3358 - <@289119054130839552>. Click on the title to see full list of commands.`
			)
			.addFields(FieldArr);

		message.reply({ embeds: [newEmbed] });
	},
};
