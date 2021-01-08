module.exports = {
    name: 'howgay',
    description: `A quick test to find out your gayness level.\nUsage: "!kifo howgay <optional_user>"`,
    execute(message, args, Discord) {
        let userid = 0;
        let howgay = 0;
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
        }
        else userid = message.author.id;
        let username = message.guild.members.resolve(userid).nickname;
        if (username == null) username = message.guild.members.resolve(userid).user.username;
        howgay = userid % 101;
        let reply = howgay + "%";
        let comment = "";
        if (howgay == 69) comment = "Nice.";
        else if (howgay == 50) comment = "That's just bisexual with extra steps.";
        else if (howgay < 10) comment = "Damn bro you're straight.";
        else if (howgay < 20) comment = "That's just kissing the homies goodnight.";
        else if (howgay < 30) comment = "Typical person except you fell in love with Ricardo.";
        else if (howgay < 40) comment = "More straight than banana, that's for sure.";
        else if (howgay < 50) comment = "You are somewhat gay. No need to thank for professional diagnosis.";
        else if (howgay < 60) comment = "You'd choose Ewan McGregor over Natalie Portman.";
        else if (howgay < 70) comment = "You like sand more than the other gender.";
        else if (howgay < 80) comment = "This is getting out of hand! Now you are gay.";
        else if (howgay < 90) comment = "Why are you gay?";
        else if (howgay < 100) comment = "You're with him! You brought him to #### me!";

        const newEmbed = new Discord.MessageEmbed()
        .setColor('a039a0')
        .setTitle(username +"'s gay level is:")
        .addFields(
            {name: reply, value: comment}
        )
        message.channel.send(newEmbed).catch();
    }
}