const kifo = require("kifo");
const Discord = require("discord.js");

module.exports = {
	name: "threads",
	description: "Manage threads in this channel.",
	options: [
		{
			name: "archive",
			description: "Bulk archive oldest threads in this channel.",
			type: "SUB_COMMAND",
			options: [
				{
					name: "count",
					type: "STRING",
					description:
						"How many oldest threads would you like to archive?",
					choices: [
						{ name: "All", value: "all" },
						{ name: "3", value: "3" },
						{ name: "5", value: "5" },
						{ name: "10", value: "10" },
						{ name: "25", value: "25" },
					],
					required: true,
				},
				{
					name: "silent",
					type: "BOOLEAN",
					description:
						"Do you want the output to be visible only by you? Defaults to false.",
				},
			],
		},
		{
			name: "delete",
			type: "SUB_COMMAND",
			description: "Bulk delete specified threads in this channel.",
			options: [
				{
					name: "count",
					type: "STRING",
					description:
						"How many oldest threads would you like to archive?",
					choices: [
						{ name: "All", value: "all" },
						{ name: "3", value: "3" },
						{ name: "5", value: "5" },
						{ name: "10", value: "10" },
						{ name: "25", value: "25" },
					],
					required: true,
				},
				{
					name: "which",
					type: "STRING",
					description: "Should I delete archived, or active threads?",
					choices: [
						{ name: "Archived", value: "archived" },
						{ name: "Active", value: "active" },
						{ name: "Both", value: "both" },
					],
					required: true,
				},
				{
					name: "silent",
					type: "BOOLEAN",
					description:
						"Do you want the output to be visible only by you? Defaults to false.",
				},
			],
		},
	],
	defaultPermission: true,
	perms: ["USE_SLASH_COMMANDS", "MANAGE_THREADS"],

	//itr = interaction
	async execute(itr) {
		const main = require(`../index.js`)
		if (
			itr.channel.type !== "GUILD_TEXT" &&
			itr.channel.type !== "GUILD_NEWS"
		)
			return itr.reply({
				embeds: [
					kifo.embed(
						"You can only run this command in text channel."
					),
				],
			});
		if (
			!itr.member
				.permissionsIn(itr.channel)
				.has(Discord.Permissions.FLAGS.MANAGE_THREADS)
		) {
			return itr.reply({
				embeds: [
					kifo.embed("You don't have `MANAGE_THREADS` permission!"),
				],
				ephemeral: true,
			});
		}
		if (
			!itr.guild.me
				.permissionsIn(itr.channel)
				.has(Discord.Permissions.FLAGS.MANAGE_CHANNELS)
		) {
			return itr.reply({
				embeds: [
					kifo.embed("I don't have `MANAGE_THREADS` permission!"),
				],
				ephemeral: true,
			});
		}
		if (
			!itr.guild.me
				.permissionsIn(itr.channel)
				.has(Discord.Permissions.FLAGS.READ_MESSAGE_HISTORY)
		) {
			return itr.reply({
				embeds: [
					kifo.embed(
						"I don't have `READ_MESSAGE_HISTORY` permission!"
					),
				],
				ephemeral: true,
			});
		}
		let subcmd = itr.options.data[0];
		let count = subcmd.options.find((o) => o.name === "count").value;
		let silent =
			subcmd.options.find((o) => o.name === "silent")?.value ?? false;
		await itr.defer({ ephemeral: silent });
		if (subcmd.name === "archive") {
			threads = await itr.channel.threads.fetch({ active: true });
			threads = threads?.threads;
			if (threads?.first() == undefined)
				return itr.editReply({
					embeds: [kifo.embed("There are no threads to archive...")],
					ephemeral: silent,
				});

			if (isNaN(count)) {
				threads = await threads.sort(
					(a, b) => a.createdAt - b.createdAt
				);
				if (threads !== undefined)
					threads.each(async (th) => {
						await th
							.setArchived(true, `Bulk archiving ${itr.user.id}`)
							.catch((err) => {
								main.log(err);
							});
					});
			} else {
				threads = await threads
					.sort((a, b) => a.createdAt - b.createdAt)
					.first(count);
				if (threads !== undefined)
					threads.forEach(async (th) => {
						await th
							.setArchived(true, `Bulk archiving ${itr.user.id}`)
							.catch((err) => {
								main.log(err);
							});
					});
			}
			itr.editReply({
				embeds: [kifo.embed(`Succesfully archived ${count} threads!`)],
				ephemeral: silent,
			});
		}
		if (subcmd.name === "delete") {
			let which = subcmd.options.find((o) => o.name === "which").value;
			let threads = new Discord.Collection();
			if (which == "archived") {
				threads = await itr.channel.threads.fetchArchived({
					fetchAll: true,
				})
				threads = threads.threads;
			} else if (which == "active") {
				threads = await itr.channel.threads.fetchActive();
				threads = threads.threads;
			} else if (which == "both") {
				threads = await itr.channel.threads.fetchArchived({
					fetchAll: true,
				});
				threads = threads.threads;
				let th2 = await itr.channel.threads.fetchActive();
				th2 = th2.threads;
				threads.concat(th2);
			}
			if (!isNaN(count)) {
				if (threads?.first() == null)
					return itr.editReply({
						embeds: [kifo.embed("There are no threads to delete.")],
						ephemeral: silent,
					});
				threads = await threads.sort((a, b) => a.createdAt - b.createdAt).first(count);

				threads.forEach(async (th) => {
					await th
						.delete(`Bulk delete by ${itr.member.tag}`)
						.catch(() => {});
				});
			} else {
				if (threads?.first() == null)
					return itr.editReply({
						embeds: [kifo.embed("There are no threads to delete.")],
						ephemeral: silent,
					});
				threads.each(async (th) => {
					await th
						.delete(`Bulk delete by ${itr.member.tag}`)
						.catch(() => {});
				});
			}
			itr.editReply({
				embeds: [kifo.embed(`Deleted ${count} ${which} threads!`)],
				ephemeral: silent,
			}).catch(() => {});
		}
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
