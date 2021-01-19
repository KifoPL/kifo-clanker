module.exports = {
    name: 'pp',
    description: `Measure your PP length with this totally reliable pp length calculator. Each user has his own constant pp length (like irl), it's not random.\nUsage: "!kifo pp <optional_user>"`,
    execute(message, args, Discord) {
        let userid = 0;
        let pplen = 0;
        let pp = "8";
        let Troll = false;
        let ppvalue = "";
        if (args[0])
        {
            if (!isNaN(args[0]))
            {
                //console.log(message.guild.members.resolve(args[0]));
                if (args[0] == 289119054130839552 || args[0] == 795638549730295820)
                {
                    Troll = true;
                }
                else if (!message.guild.members.resolve(args[0])) return message.reply("user not found.");
                userid = args[0];
            }
            else
            {
                if (message.mentions.users.firstKey() != undefined)
                {
                    if (!message.guild.members.resolve(message.mentions.users.firstKey())) return message.reply("user not found.");
                    userid = message.mentions.users.firstKey();
                }
            }
        }
        else userid = message.author.id;
        if (userid == 289119054130839552 || args[0] == 289119054130839552) Troll = true;
        let username = message.guild.members.resolve(userid).nickname;
        if (username == null) username = message.guild.members.resolve(userid).user.username;
        if (!Troll)
        {
            pplen = userid % 13;
            for (i = 0; i < pplen; i++) pp += "=";
            pp += "D";
    
            ppvalue = (pplen + 2) * 2 + " cm";
        }
        else 
        {
            pp = "8==============================D";
            ppvalue = "69 cm";
        }
        const newEmbed = new Discord.MessageEmbed()
        .setColor('a039a0')
        .setTitle(username +"'s PP:")
        .addFields(
            {name: pp, value: ppvalue}
        )
        message.channel.send(newEmbed).catch();
    }
}