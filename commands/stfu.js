module.exports = {
    name: 'stfu',
    description: `This is an eloquent way to say "Thank you for this conversation we've had".\nUsage: "!kifo stfu <optional_ping>"`,
    execute(message, args) {
        let reply = "I honestly don't even know where to start, but what you're doing is incredibly annoying, needless, and generally speaking, stupid. Continuing to do so may result in permanent damage of your brain cells. As I care for your health, please stop doing this.";
        if (args[0])
        {
            if (!isNaN(args[0]))
            {
                //console.log(message.guild.members.resolve(args[0]));
                if (!message.guild.members.resolve(args[0])) return message.reply("user not found.");
                else
                {
                    userid = args[0];
                }
            }
            else
            {
                if (!message.guild.members.resolve(args[0].slice(3, args[0].length-1))) return message.reply("user not found.");
                else userid = args[0].slice(3, args[0].length-1);
            }
            reply = "<@" + args[0] + ">\n" + reply;
        }
        message.channel.send(reply);
    }
}