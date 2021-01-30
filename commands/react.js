module.exports = {
    name: 'react',
    description: 'ADMIN ONLY!\nThis command tells the bot to react to all messages in the channel with specific reactions.\nUsage: "!kifo react <on/off> <emote1> <optional_emote2> ... <optional_emoten>"\n"!kifo react list" for list of channels, in which the command is active.',
    execute(message, args) {
        if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("This is ADMIN ONLY command.");
        if (!args[0]) return message.reply("Insufficient arguments!");
        if (!(args[0].toUpperCase() == "ON" || args[0].toUpperCase() == "OFF")) return message.reply("Error: Specify, if you want to enable or disable the command first.");
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
            if (!args[0]) return message.reply("Insufficient arguments!");
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