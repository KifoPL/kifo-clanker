module.exports = {
    name: 'stfu',
    description: `This is an eloquent way to say "Thank you for this conversation we've had".\nUsage: "!kifo stfu <optional_ping>"`,
    execute(message, args) {
        let reply = "I honestly don't even know where to start, but what you're doing is incredibly annoying, needless, and generally speaking, stupid. Continuing to do so may result in permanent damage of your brain cells. As I care for your health, please stop doing this.";
        if (args[1] != undefined) message.reply("Too many arguments!");
        if (args[0])
        {
            if (message.mentions.users.firstKey() != undefined) reply = args[0] + reply;
            else if (!isNaN(args[0]))
            {
                if (!message.guild.members.resolve(args[0])) return message.reply("user not found.");
                else
                {
                    reply = "<@" + args[0] + ">\n" + reply;
                }
            }
            
        }
        message.channel.send(reply);
    }
}