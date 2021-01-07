module.exports = {
    name: 'cringe',
    description: `Express your feelings to another discord user with this beautiful poem.\nUsage: "!kifo cringe <optional_ping>"`,
    execute(message, args) {
        let reply = "Roses are red,\nViolets are blue,\nYou are cringe.\nSeriously. You're cringe.";
        if (args[1] != undefined) message.reply("Too many arguments!");
        if (args[0])
        {
            if (message.mentions.users.firstKey() != undefined) reply = args[0] + "\n" + reply;
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