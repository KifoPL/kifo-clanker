module.exports = {
    name: 'react',
    description: 'This command tells the bot to react to all messages in the channel with specific reactions.\n"!kifo react list" to list channels, where the command is active.',
    usage: "!kifo react <on/off> <emote1> <optional_emote2> ... <optional_emoten>",
    adminonly: true,
    execute(message, args) {
        if (message.guild == null) return message.reply("you can only run this command on the server.");
        if (!(args[0].toUpperCase() == "ON" || args[0].toUpperCase() == "OFF")) return message.reply(`Usage: ${this.usage}.`);
        let option = args[0].toUpperCase();
        args.shift();
        let emotes = args;
        // for (i = 0; i < emotes.length; i++)
        // {
        //     if (message.guild.emojis.cache.find(emojis => emojis.id == emotes[i].slice(emotes[i].length - 19, emotes[i].length - 1)) == undefined)
        //     {
        //         return message.reply(emotes[i] + " is not a valid emote. Make sure that emotes specified in the command are in **THIS** server.");
        //     }
        // }

        if (option == "ON")
        {
            if (!args[0]) return message.reply(`Usage: ${this.usage}.`);
            if (args[22]) return message.reply(`Too many reactions!`);
            let params = [option, emotes];
            message.reply("it's ON!");
            return params;
        }
        else
        {
            let params = [option, 0];
            message.reply("it's OFF!");
            return params;
        }
    }
}