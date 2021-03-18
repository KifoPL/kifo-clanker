const {MessageMentions} = require('discord.js');
module.exports = {
    name: 'reverse',
    description: 'This command reverses anything you type.',
	usage: "!kifo reverse <text>",
	adminonly: false,
    execute(message, args, Discord) {
		if (!args[0]) return message.reply("Forgot to type in text you wish to reverse. Use `!kifo reverse <text>`");
		var array = args.join(" ").split("");
		array.reverse();
		var output = array.join("");
		var unfunny = false;
		if (output.includes("@everyone") || output.includes("@here") || output.includes("<@&")) return message.reply("if you think you're funny, think again.");
		message.channel.send(output);
    }
}