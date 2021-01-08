module.exports = {
    name: 'cringe',
    description: `Express your feelings to another discord user with this beautiful poem.\nUsage: "!kifo cringe <optional_ping>"`,
    execute(message, args) {
        let reply = "Roses are red,\nViolets are blue,\nYou are cringe.\nSeriously. You're cringe.";
        if (args[1] != undefined) message.reply("Too many arguments!");
        if (args[0])
        {
            if (message.mentions.users.firstKey() != undefined) 
            {
                if (message.mentions.users.firstKey() == 289119054130839552 || message.mentions.users.firstKey() == 795638549730295820)
                {
                    return message.reply(`https://tenor.com/view/snape-harry-potter-you-dare-use-my-own-spells-against-me-potter-severus-snape-gif-16590981`)
                }
                reply = args[0] + "\n" + reply;
            }
            else if (!isNaN(args[0]))
            {
                if (!message.guild.members.resolve(args[0])) return message.reply("user not found.");
                else
                {
                    if (args[0] == 289119054130839552 || args[0] == 795638549730295820)
                    return message.reply(`https://tenor.com/view/snape-harry-potter-you-dare-use-my-own-spells-against-me-potter-severus-snape-gif-16590981`)
                    reply = "<@" + args[0] + ">\n" + reply;
                }
            }
            
        }
        message.channel.send(reply).catch();
    }
}