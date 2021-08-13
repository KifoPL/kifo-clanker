const Discord = require("discord.js");
module.exports = {
	name: "urmum",
	description: "Random *yo momma* joke.",
	usage: ["`urmum` - get a random *yo momma* joke."],
	category: "FUN",
	guildonly: false,
	perms: ["USE_APPLICATION_COMMANDS"],
	execute(itr) {
		const kifo = require("kifo");
		const api = require("axios");
		api.get(`https://yomomma-api.herokuapp.com/jokes`)
			.then((response) => {
				if (response.status === 200) {
					itr
						.reply({
							embeds: [
								kifo.embed(
									`${response.data.joke}\n\n*Best regards from <@!${itr.user.id}>.*`,
									`Ur mum`
								),
							],
						})
						.catch(() => { });
				} else
					itr
						.reply({
							embeds: [
								kifo.embed(`Error trying to access ur mum's server.`),
							],
						})
						.catch(() => { });
			})
			.catch((error) => {
				itr
					.reply({
						embeds: [
							kifo.embed(
								`Unable to get random joke from the server!\n\nError: ${error.stack}`,
								"Error!"
							),
						],
					})
					.catch(() => { });
			});
	},
};
