module.exports = {
    name: 'stfu',
    description: `This is an eloquent way to say "Thank you for this conversation we've had".`,
    usage: `!kifo stfu <optional_ping>`,
    adminonly: false,
    execute(message, args) {
        let reply = "I honestly don't even know where to start, but what you're doing is incredibly annoying, needless, and generally speaking, stupid. Continuing to do so may result in permanent damage of your brain cells. As I care for your health, please stop doing this.";
        if (args[1] != undefined) return message.reply("Too many arguments!");
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