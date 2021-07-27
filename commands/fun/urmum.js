const Discord = require("discord.js");
module.exports = {
	name: "urmum",
	description: "Random *yo momma* joke.",
	usage: ["`urmum` - get a random *yo momma* joke."],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args) {
		const kifo = require("kifo");
		const api = require("axios")
		api.get(`https://yomomma-api.herokuapp.com/jokes`).then((response) => {
			if (response.status === 200) {
				message.reply(kifo.embed(`${response.data.joke}\n\n*Best regards from <@!${message.author.id}>.*`, `Ur mum`)).catch(() => { })
			}
			else message.reply(kifo.embed(`Error trying to access server.`)).catch(() => { })
		}).catch((error) => {
			message.reply(kifo.embed(`Unable to get random joke from the server!\n\nError: ${error.stack}`, "Error!")).catch(() => { })
		})
	},
};