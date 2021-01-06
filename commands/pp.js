module.exports = {
    name: 'pp',
    description: `Measure your PP length with this totally reliable pp length calculator. Each user has his own constant pp length (like irl), it's not random.\nUsage: "!kifo pp <optional_user>"`,
    execute(message, args, Discord) {
        let userid = 0;
        let pplen = 0;
        let pp = "8";
        if (args[0])
        {
            if (!isNaN(args[0]))
            {
                console.log(message.guild.members.resolve(args[0]));
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
        }
        else userid = message.author.id;
        let username = message.guild.members.resolve(userid).nickname;
        if (username == null) username = message.guild.members.resolve(userid).user.username;
        pplen = userid % 13;
        for (i = 0; i < pplen; i++) pp += "=";
        pp += "D";
        let ppvalue = "";
        ppvalue = pplen + 2 + " cm";
        const newEmbed = new Discord.MessageEmbed()
        .setColor('a039a0')
        .setTitle(username +"'s PP:")
        .addFields(
            {name: pp, value: ppvalue}
        )
        message.channel.send(newEmbed);
    }
}