//libraries
const Discord = require('discord.js');
const WOKCommands = require('wokcommands');
require('dotenv')?.config();
const fs = require('fs');
const ms = require('ms');
const prefix = `${process.env.PREFIX} `;

//client login
const client = new Discord.Client();
async function loadowner()
{
    clientapp = await client.fetchApplication().catch();
    Owner = clientapp.owner;
    console.log("Bot owner object loaded!");
}

//DATABASE CONNECTION
const db = require('redis').createClient(process.env.REDIS_URL);
db.on('connect', function() {
    console.log('Database online!');
})

client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    client.commands.set(command.name, command);
    console.log(file);
}
command = require(`./help.js`);
client.commands.set(command.name, command);

//Hello message
async function hello(message) {
    //I have to do it here too
    if (message.content.trim() == prefix.trim())
    {
        if (message.deleted) return;
        message.channel.startTyping().catch();
        const event = new Date(Date.now());
            console.log(message.author.tag, "issued !kifo (welcome msg) in", message.channel.name, "at", event.toUTCString());
        const helloEmbed = new Discord.MessageEmbed()
        .setAuthor("Hello there (click for invite link)!", null, "https://discord.com/api/oauth2/authorize?client_id=795638549730295820&permissions=8&scope=applications.commands%20bot")
        .setColor('a039a0')
        .setTitle("About me (click for commands list)")
        .setURL("https://github.com/KifoPL/kifo-clanker/wiki")
        .setThumbnail(message.guild.me?.user?.avatarURL({format: "png", dynamic: true, size: 64}))
        .setDescription("Feel free to follow my [repo](https://github.com/KifoPL/kifo-clanker) - if you find a bug / have a cool idea for a new feature, please [create a ticket](https://github.com/KifoPL/kifo-clanker/issues/new).")
        .addField("try !kifo help", "This will list all commands available to you (you can see more commands if you're an Admin)!")
        .addField("\u200B", "This bot is developed by [KifoPL](https://github.com/KifoPL).\nDiscord: <@289119054130839552> : @KifoPL#3358\nReddit: [u/kifopl](http://reddit.com/u/kifopl)\n[Paypal](https://paypal.me/Michal3run) (developing bot takes a lot of time, by donating you help me pay my electricity / internet bills!)");
        message.channel.send(helloEmbed);
        message.channel.stopTyping(true);
        return;
    }
}
//can be useful at some point in the future
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

//IF CORRECT CHANNEL, REACT
async function react(message) {
    db.exists("RT" + message.channel.id, function(err, reply)
    {
        if (reply === 1)
        {
            if (!message.content.startsWith(prefix))
            {
                //It will react to his own messages that have attachments, this is so #kenoc-hall-of-fame looks better
                if (message.author.id != client.user.id)
                {
                    if (message.author.bot) return;
                }
                else
                {
                    if (message.embeds[0] == null) return;
                }
                db.lrange("RT" + message.channel.id, 0, -1, function(err, reply) {
                for (i = 0; i < reply.length; i++) 
                {
                    if (message.deleted) return;
                    message.react(reply[i]).catch();
                    var eventRT = new Date(Date.now());
                }
                console.log("Reacted in " + message.guild.name + ", " + message.channel.name + " at " + eventRT.toUTCString());
                });
            }
        }
    })
}
//IF CORRECT CHANNEL, SUPERSLOWMODE
async function superslow(message) {
    db.exists("SM" + message.channel.id, function(err, reply)
    {
        if (reply === 1)
        {
            if (!(message.member.permissions.has("ADMINISTRATOR")))
            {
                let slowmode;
                db.hget("SM" + message.channel.id, "time", function(err, reply2)
                {
                    slowmode = reply2;
                })
                if (slowmode == 0) return;
                db.hexists("SM" + message.channel.id, message.author.id, function(err, reply2)
                {
                    if (reply2 === 1)
                    {
                        db.hget("SM" + message.channel.id, message.author.id, async function(err, reply3)
                        {
                            
                            if (message.createdTimestamp - reply3 <= slowmode)
                            {
                                if (message.content.trim() == prefix.trim())
                                {

                                    message.author.send(`You can't talk in ${message.channel.name} yet, please wait another ${ms(slowmode - (message.createdTimestamp - reply3), {long : true})}.`).catch();
                                    await message.delete().catch();
                                    return;
                                }
                                else
                                {
                                    //I'm not kidding this msg works, because apparently subtraction forces integer type ¯\_(ツ)_/¯
                                    let msg = "You can't talk in " + message.channel.name + " for **" + ms(slowmode - (message.createdTimestamp - reply3), {long : true}) + "**. You can check, if you can talk (without risking waiting another " + ms(slowmode - (message.createdTimestamp - reply3) + (message.createdTimestamp - reply3), {long : true}) + "), by typing **" + prefix.trim() + "**.";
                                    message.author.send(msg).catch();
                                    await message.delete().catch();
                                    return;
                                }
                            }
                            else
                            {
                                if (message.content.trim() == prefix.trim())
                                {
                                    message.author.send(`You can already talk in #${message.channel.name}.`).catch();
                                    await message.delete().catch();
                                    return;
                                }
                                else db.hset("SM" + message.channel.id, message.author.id, message.createdTimestamp);
                            }
                        })
                    }
                    else
                    {
                        db.hset("SM" + message.channel.id, message.author.id, message.createdTimestamp);
                    }
                })
            }
        }
    })
}
//various checks if we can proceed with commands
function checks(message)
{
    //No bot in #citizens

    if (message.channel.id == "707650931809976391") return false;
  
    //Only I can use Offline test
    if (message.content.startsWith(prefix.trim()) && message.guild?.me.id == "796447999747948584" && message.author.id != "289119054130839552") {message.reply("Only KifoPL#3358 can use this bot."); return false;}

    //Perms beggar, only enters second "If" if first is true, the most optimized way to beg for perms I came up with
    if (!message.guild?.me.permissions.has("ADMINISTRATOR")) if (message.content.startsWith(prefix) && !message.author.bot) {message.reply("until I have time to calculate all permissions for individual commands, this bot requires Admin to work."); return false;}

    return true;
}
async function commands(message) {
    //If command detected, create args struct
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    var debug = 'false';
    db.get('debug', function (err, reply) {
        debug = reply;
    });
    
    for (const file of commandFiles) {
        const splitter = (file.length - 3);
        if (command == "debug" && message.author == Owner)
        {
            await sleep(200);
            debug == 'true' ? debug = 'false' : debug = 'true';
            message.reply("debug mode set to " + debug);
            db.set('debug', debug);
            if (debug == 'true')
            {

                client.user.setStatus('dnd').then(() => client.user.setActivity({
                    name: "The bot is undergoing maintenance, the commands are disabled for now (passive functions still work).",
                    type: 'PLAYING',
                }));
            }
            else
            {
                client.user.setStatus('online').then(() => client.user.setActivity({
                    name: `Type ${prefix}to interact with the bot! (also Kifo Clanker >>>> Giratina)`,
                    type: 'PLAYING',
                }));
            }
            return;
        }
        if (debug == 'true' && message.author != Owner) return message.reply("the bot is currently undergoing maintenance. Although it still works (reactions, super slow-mode, etc.), you cannot use commands for a while. Please be patient (it usually takes me an hour at most to deal with maintenance).")
        if (command == 'serverlist' && message.author == Owner)
        {
            console.log("run SERVERLIST command");
            let serversarr = [];
            let serverembed = new Discord.MessageEmbed();
            await message.client.guilds.cache.each(guild => {
                serversarr.push({name: guild.name, value: `<:owner:823658022785908737> ${guild.owner.user.tag}, ${guild.memberCount} members.`});
            })
            serverembed.addFields(serversarr).setTitle("Server list:").setFooter(new Date(Date.now()).toUTCString()).setColor('a039a0');
            message.channel.send(serverembed).catch();
            return;
        }
        if (command == "help")
        {
            const event = new Date(Date.now());
            console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", event.toUTCString());
            client.commands.get(command).execute(message, args, Discord);
            return;
        }
        else if (command == "error")
        {
            const event = new Date(Date.now());
            console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", message.guild.name, "at", event.toUTCString());
            client.commands.get(command).execute(message, args, Discord, client);
            return;
        }
        else if (command == "react")
        {
            const command2 = require(`./commands/react.js`);
            if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("This is ADMIN ONLY command.");
            if (!args[0])
            {
                db.exists("RT" + message.channel.id, function(err, reply)
                {
                    if (reply === 1)
                    {
                        db.hget("RT" + message.channel.id, "time", function(err, reply2)
                        {
                            return message.reply("react is already ON!");
                        })
                    }
                    else return message.reply("react is OFF. Type " + command2.usage + " to set it up.")
                })
                //just in case
                return;
            }
            const event = new Date(Date.now());
            console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", message.guild.name, "at", event.toUTCString());
            if (args[0].toUpperCase() == "LIST")
            {
                var FieldReactChannels = {name: "name", value: "description"};
                const newReactChannelsEmbed = new Discord.MessageEmbed()
                .setColor('a039a0')
                .setTitle('List of channels, where command is active:');
                message.guild.channels.cache.each(channel => {
                    db.exists("RT" +channel.id, function(err, reply)
                    {
                        if (reply === 1)
                        {
                            db.lrange("RT" + channel.id, 0, -1, function(err, reply) {
                                message.channel.send("<#" + channel.id + ">: " + reply); //TODO fix it someday
                            })
                            var FieldReactChannels = {}
                            FieldReactChannels.name = "#" + channel.name;
                            FieldReactChannels.value = "Reactions ON.";
                            newReactChannelsEmbed.addField(FieldReactChannels.name, FieldReactChannels.value);
                            //console.log(newReactChannelsEmbed.fields);
                        }
                    })
                })
                //console.log(newReactChannelsEmbed);
                message.channel.send(newReactChannelsEmbed);
                message.channel.send("End of list!");
                return;
            }
            reactreturn = client.commands.get(command).execute(message, args, Discord, client);
            if (reactreturn[0] == "ON")
            {
                //channellist.set(message.channel.id, message.channel);
                let arrout = reactreturn[1];
                for (i = 0; i < arrout.length; i++)
                {
                    db.rpush(["RT" + message.channel.id, arrout[i]], function(err, reply)
                    {
                    })
                }
                console.log("I will now react in " + message.channel.name + " with " + arrout);
            }
            else if (reactreturn[0] == "OFF")
            {
                //channellist.delete(message.channel.id);
                db.del("RT" + message.channel.id);
            }
            return;
        }
        else if (command == "superslow")
        {
            //DB structure:
            // "SM" + channel id
            // {
            //     time: ms(time)
            //     userid: timestamp
            //     userid: timestamp
            // }

            const commandfile = require(`./commands/superslow.js`);
            if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("This is ADMIN ONLY command.");
            if (!args[0])
            {
                db.exists("SM" + message.channel.id, function(err, reply)
                {
                    if (reply === 1)
                    {
                        db.hget("SM" + message.channel.id, "time", function(err, reply2)
                        {
                            return message.reply("Super slow-mode is already set here to " + ms(ms(reply2, {long : true})));
                        })
                    }
                    else return message.reply("Super slow-mode is NOT activated. Type " + commandfile.usage + " to set it up.")
                })
                //just in case
                return;
            }
            const event = new Date(Date.now());
            console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", message.guild.name, "at", event.toUTCString());
            if (args[0]?.toUpperCase() == "LIST")
            {
                var FieldReactChannels = {name: "name", value: "description"};
                const newReactChannelsEmbed = new Discord.MessageEmbed()
                .setColor('a039a0')
                .setTitle('List of channels, where command is active:');
                message.guild.channels.cache.each(channel => {
                    db.exists("SM" +channel.id, function(err, reply)
                    {
                        if (reply === 1)
                        {
                            db.hget("SM" + channel.id, "time", function(err, reply2) {
                                message.channel.send("<#" + channel.id + ">: " + ms(reply2, {long : true})); //TODO fix it someday
                            })
                            var FieldReactChannels = {}
                            FieldReactChannels.name = "#" + channel.name;
                            FieldReactChannels.value = "Super slow-mode ON.";
                            newReactChannelsEmbed.addField(FieldReactChannels.name, FieldReactChannels.value);
                            //console.log(newReactChannelsEmbed.fields);
                        }
                    })
                })
                //console.log(newReactChannelsEmbed);
                message.channel.send(newReactChannelsEmbed);
                message.channel.send("End of list!");
                return;
            }
            //[0] - isOff, [1] - ms(args[0])
            superslowreturn = client.commands.get(command).execute(message, args, Discord, client);
            if (superslowreturn == null) return;
            //Just making sure lmao
            if (superslowreturn[0] == undefined) return;
            if (!superslowreturn[0])
            {
                db.hexists("SM" + message.channel.id, "time", function(err, reply)
                {
                    if (reply === 1)
                    {
                        db.hget("SM" + message.channel.id, "time", function(err, timestamp)
                        {
                            if (timestamp == superslowreturn[1]) return message.reply("it's already set to " + ms(superslowreturn[1], {long: true}) + "!");
                            db.hset("SM" + message.channel.id, "time", superslowreturn[1]);
                            return message.reply("Super slow-mode was already activated. It is now set to " + ms(superslowreturn[1], {long: true}));
                        })
                    }
                    else
                    {
                        db.hmset("SM" + message.channel.id, {
                            'time': superslowreturn[1]
                        })
                        message.reply("set Super slow-mode to " + ms(superslowreturn[1], {long: true}) + ".");
                        //This is to notify users of Super slow-mode active in the channel.
                        message.channel.setRateLimitPerUser(10);
                        return;
                    }
                })
            }
            else if (superslowreturn[0])
            {
                db.hexists("SM" + message.channel.id, "time", function(err, reply)
                {
                    if (reply === 1)
                    {
                        db.del("SM" + message.channel.id);
                        message.reply("Super slow-mode is successfully disabled.");
                        message.channel.setRateLimitPerUser(0);
                    }
                    else return message.reply("this channel does not have super slow-mode. Maybe you already deleted it?");
                })
            }
            return;
        }
        else {
            if (command === file.toLowerCase().substring(0, splitter)) {
                const event = new Date(Date.now());
                console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", message.guild.name, "at", event.toUTCString());
                debug = client.commands.get(command).execute(message, args, Discord);
                return;
            }
        }
    }
    message.channel.send("Command not found. Type `!kifo help` for list of commands.").catch();
}
async function onmessage(message) {

    react(message).catch();
    await superslow(message).catch();

    if (message.deleted) return;

    speakcheck = checks(message);
    
    if (speakcheck) {

        hello(message).catch();
    
        if (!message.content.startsWith(prefix) || message.author.bot) return;
    
        //No role and @here and @everyone pings
        if (message.mentions.roles.firstKey() != undefined) return message.reply("no roles in commands!");
        if (message.mentions.everyone) return message.reply("don't even try pinging...");

        if (message.content.startsWith(prefix) && message.content.length > prefix.length)
            commands(message); 
    }
}

let debug;
let clientapp;
//that's @KifoPL#3358
let Owner;

const guildIdTest = '822800862581751848';

client.once('ready', () => {
    console.log('Kifo Clanker™ is online!');
    loadowner();
    debug = false;

    //DELETING SLASH COMMANDS CODE FOR NOW, I tried using prebuilt API, but it was "too" prebuild and it didn't fit my bot at all. Will have to do stuff manually...

    //This line is executed by default, but I'm just making sure the status is online (other factors could change the status)
    client.user.setStatus('online');
    client.user.setActivity({
        name: `Type "${prefix}" to interact with me! (also Kifo Clanker >>>> Giratina)`,
        type: 'PLAYING',
    })

    //for WoofWoofWolffe feature
    client.guilds.fetch('698075892974354482').then(guild => {
        guild.fetchInvites().then(invites => {
            WoofInviteCount = invites.find(invite => invite.inviter.id == '376956266293231628').uses;
        })
    })
    //for HaberJordan feature
    client.guilds.fetch('698075892974354482').then(guild => {
        guild.fetchInvites().then(invites => {
            HaberInviteCount = invites.find(invite => invite.inviter.id == '221771499843878912').uses;
        })
    })
});

//USED BY REACT COMMAND
let reactreturn;

client.on('message', message => {
    //this allows me to 1. catch stuff and 2. use async
    onmessage(message).catch(err => {console.log(err)});    
});

//Code for adding WoofWoof role to members added by WoofWoofWolffe (and for HaberJordan Legion too)
let WoofInviteCount;
let HaberInviteCount;

client.on('guildMemberAdd', member => {
    member.guild.fetchInvites().then(invites => {
        //WoofWoof
        if (invites.find(invite => invite.inviter.id == '376956266293231628').uses == WoofInviteCount + 1)
        {
            member.roles.add(member.guild.roles.cache.find(role => role.id == '746558695139180625')).catch(console.error);
            WoofInviteCount++;
        }
        //HaberJordan
        else if (invites.find(invite => invite.inviter.id == '221771499843878912').uses == HaberInviteCount + 1)
        {
            member.roles.add(member.guild.roles.cache.find(role => role.id == '744082967307092039')).catch(console.error);
            HaberInviteCount++;
        }
    }).catch(console.error);
})

client.login(process.env.LOGIN_TOKEN);
