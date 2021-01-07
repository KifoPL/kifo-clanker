module.exports = {
    name: 'cringe',
    description: `Express your feelings to another discord user with this beautiful poem.\nUsage: "!kifo cringe <optional_ping>"`,
    execute(message, args) {
        let reply = "Roses are red,\nViolets are blue,\nYou are cringe.\nSeriously. You're cringe.";
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