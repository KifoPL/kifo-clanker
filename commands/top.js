module.exports = {
    name: 'top',
    description: 'This command lists x messages with most reactions from other channel.\nUsage: "!top <x> <time_period> <other_channel> <reaction> <ping>"\nType "ping" if you want to mention authors (Admin only!)\n\nBeware! Due to the way Discord API works, if there are more than 100 messages in your time-span, only the last 100 messages will be checked.',
    async execute(message, args, Discord) {
        const ms = require(`ms`);
        if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("sorry, only Admins can ping authors.");
        if (!args[3]) return message.reply("insufficient arguments. Use !top <x> <time_period> <other_channel> <reaction>.");
        if (isNaN(args[0])) return message.reply("incorrect amount of posts.");
        if (args[0] < 1 || args[0] > 100) return message.reply("incorrect amount of posts. You must select at least 1, but not more than 100.");
        let x = args[0];
        if (isNaN(ms(args[1]))) return message.reply("incorrect time period. Please specify correct time period.")
        if (ms(args[1]) < ms('10s') || ms(args[1]) > ms('14d')) return message.reply("incorrect amount of time. For the command to work, please input period of time that is between 10 seconds and 14 days.");
        if (message.guild.channels.cache.find(channel => channel.id == args[2].slice(2, 20)) == undefined) return message.reply("channel does not exist. Please input correct channel.");
        //console.log(message.guild.emojis.cache.find(emojis => emojis.id == args[3].slice(args[3].length-19,args[3].length-1)));
        //console.log(args[3].slice(args[3].length-19,args[3].length-1));
        if (message.guild.emojis.cache.find(emojis => emojis.id == args[3].slice(args[3].length - 19, args[3].length - 1)) == undefined) return message.reply("this reaction does not exist / is not from this server. Please use only emojis from this server.");
        let ping = false;
        if (args[4] != undefined) {
            if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("sorry, this is admin only command."); else if (args[4] == "ping") ping = true; else return message.reply("type **ping** if you want to ping authors. If not, end the command at emoji.");
        }
        let now = Date.now();
        let whichchannel = message.channel.guild.channels.cache.find(channel => channel.id == args[2].slice(2, 20));
        let chmessages = [];
        let key = args[3].slice(args[3].length - 19, args[3].length - 1);
        //if (whichchannel.messages.resolve(checklimit).createdTimestamp >= now - ms(args[1])) message.channel.send("Warning! Over 100 messages detected. Every message before " + whichchannel.messages.resolve(checklimit).createdTimestamp + " will not be included.");
        await whichchannel.messages.fetch().then(messages => messages.filter(m => now - m.createdTimestamp <= ms(args[1]))).then(messages => messages.filter(m => m.reactions.resolve(key) != undefined)).then(messages => chmessages = messages.array()).catch(err => console.log(err));
        if (!chmessages[0]) return message.reply("no posts found matching criteria. Maybe try longer time period?");
        //console.log("////////////////////////////chmessages////////////////////////////");
        //console.log(chmessages);
        //console.log(chmessages[0].reactions.cache);
        chmessages.sort((a, b) => {
            if (b.reactions.cache.find(reaction => reaction.emoji.id == args[3].slice(args[3].length - 19, args[3].length - 1)) == undefined) {
                //console.log("b is undefined...");
                return -1;
            }
            if (a.reactions.cache.find(reaction => reaction.emoji.id == args[3].slice(args[3].length - 19, args[3].length - 1)) == undefined) {
                //console.log("a is undefined...");
                return 1;
            }
            return b.reactions.resolve(key).count - a.reactions.resolve(key).count;
        });
        //console.log(chmessages);
        let loops = 0;
        if (!chmessages[x]) {
            while (chmessages[loops] != undefined) loops++;
        }
        else loops = x;
        // for (i = 0; i < loops; i++)
        // {
        //    console.log("////////////////////////////chmessages" + i + "/////////////////////////////////");
        //    console.log(chmessages[i]);
        // }
        let ii = 1;
        for (i = 0; i < loops; i++) {
            if (i > 0 && chmessages[i].reactions.resolve(key).count == chmessages[i - 1].reactions.resolve(key).count) {
                loops++;
                ii--;
                if (!chmessages[loops]) loops--;
            }
            if (ping) {
                message.channel.send("**> Top " + ii + "** by <@" + chmessages[i].author.id + "> with **" + chmessages[i].reactions.resolve(key).count + "** <:" + chmessages[i].reactions.resolve(key).name + ":" + key + ">");

            } else {
                message.channel.send("**> Top " + ii + "** by **" + chmessages[i].author.username + "** with **" + chmessages[i].reactions.resolve(key).count + "** <:" + chmessages[i].reactions.resolve(key).name + ":" + key + ">");
            }
            if (chmessages[i].content.length > 0) message.channel.send("``" + chmessages[i].content + "``");
            if (chmessages[i].attachments.array().length > 0 && chmessages[i].attachments.array()[0] != undefined)
            {
                await message.channel.send(chmessages[i].attachments.array()[0])
                message.channel.send(`Original post: https://discord.com/channels/${chmessages[i].channel.guild.id}/${chmessages[i].channel.id}/${chmessages[i].id}`);
            }
            else message.channel.send(`Original post: https://discord.com/channels/${chmessages[i].channel.guild.id}/${chmessages[i].channel.id}/${chmessages[i].id}`);
            ii++;
        }
        if (loops < args[0]) message.channel.send("No more posts with given criteria found.")
    }
}