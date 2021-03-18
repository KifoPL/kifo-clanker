const { timeStamp } = require('console');
const Discord = require('discord.js');
//-------------UNCOMMENT BELOW LINE FOR OFFLINE TEST---------------
//const config = require('./config.json');

const client = new Discord.Client();
const db = require('redis').createClient(process.env.REDIS_URL);
db.on('connect', function() {
    console.log('Database online!');
})

const prefix = '!kifo ';

const fs = require('fs');
const { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } = require('constants');
const ms = require('ms');

client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);

    client.commands.set(command.name, command);
    console.log(file);
}
command = require(`./help.js`);
client.commands.set(command.name, command);

client.once('ready', () => {
    console.log('Kifo Clanker is online!');
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

    //IF CORRECT CHANNEL, REACT
    db.hexists(message.channel.id, "time", function(err, reply)
    {
        //TODO fix this as soon as I have time to rework react
        if (reply === 0)
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
                    if (message.attachments.first() == null) return;
                }
                db.lrange(message.channel.id, 0, -1, function(err, reply) {
                for (i = 0; i < reply.length; i++) 
                {
                    message.react(reply[i]).catch();
                }
                });
            }
        }
        //TODO for now this means it is super slow-mode, fix when reworking react
        else if (reply === 1)
        {
            let slowmode;
            db.hget(message.channel.id, "time", function(err, reply2)
            {
                slowmode = reply2;
            })
            db.hexists(message.channel.id, message.author.id, function(err, reply2)
            {
                if (reply2 === 1)
                {
                    db.hget(message.channel.id, message.author.id, function(err, reply3)
                    {
                        if (message.createdAt.getTime() - reply3 <= slowmode)
                        {
                            let msg = "You can't talk in " + message.channel.name + " for " + ms(message.createdAt.getTime() - reply2, {long : true}) + ".";
                            message.author.send(msg);
                            message.delete().catch();
                        }
                        else
                        {
                            db.hset(message.channel.id, message.author.id, message.createdAt.getTime());
                        }
                    })
                }
                else
                {
                    db.hset(message.channel.id, message.author.id, message.createdAt.getTime());
                }
            })
        }
    })
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    //No bot in #citizens
    if (message.channel.id == "707650931809976391") return;
    
    //No role and @here and @everyone pings
    if (message.mentions.roles.firstKey() != undefined) return message.reply("no roles in commands!");
    if (message.mentions.everyone) return message.reply("don't even try pinging...");

    //If command detected, create args struct
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    for (const file of commandFiles) {
        const splitter = (file.length - 3);
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
            if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("This is ADMIN ONLY command.");
            if (!args[0]) return message.reply("Insufficient arguments!");
            const event = new Date(Date.now());
            console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", message.guild.name, "at", event.toUTCString());
            if (args[0].toUpperCase() == "LIST")
            {
                var FieldReactChannels = {name: "name", value: "description"};
                const newReactChannelsEmbed = new Discord.MessageEmbed()
                .setColor('a039a0')
                .setTitle('List of channels, where command is active:');
                message.guild.channels.cache.each(channel => {
                    db.exists(channel.id, function(err, reply)
                    {
                        if (reply === 1)
                        {
                            db.lrange(channel.id, 0, -1, function(err, reply) {
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
                    //TODO add "react" as first field, so it's different from superslow. For now, let's home there is no emote called 'time'.
                    db.rpush([message.channel.id, arrout[i]], function(err, reply)
                    {
                    })
                    console.log("I will now react in " + message.channel.name + " with " + arrout);
                }
            }
            else if (reactreturn[0] == "OFF")
            {
                //channellist.delete(message.channel.id);
                db.del(message.channel.id);
            }
            return;
        }
        else if (command == "superslow")
        {
            //DB structure:
            // channel id
            // {
            //     time: ms(time)
            //     userid: timestamp
            //     userid: timestamp
            // }

            if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("This is ADMIN ONLY command.");
            if (!args[0]) return message.reply("Insufficient arguments!");
            const event = new Date(Date.now());
            console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", message.guild.name, "at", event.toUTCString());
            //[0] - isOff, [1] - ms(args[0])
            superslowreturn = client.commands.get(command).execute(message, args, Discord, client);
            if (!superslowreturn[0])
            {
                db.hexists(message.channel.id, "time", function(err, reply)
                {
                    if (reply === 1)
                    {
                        db.hget(message.channel.id, "time", function(err, timestamp)
                        {
                            if (timestamp == superslowreturn[1]) return message.reply("it's already set to " + ms(superslowreturn[1], {long: true}) + "!");
                            db.hset("time", superslowreturn[1]);
                            return message.reply("Super slow-mode was already activated. It is now set to " + ms(superslowreturn[1], {long: true}));
                        })
                    }
                    else
                    {
                        db.hmset(message.channel.id, {
                            'time': superslowreturn[1]
                        })
                        //This is to notify users of Super slow-mode active in the channel.
                        message.channel.setRateLimitPerUser(10);
                    }
                })
            }
            else
            {
                db.hexists(message.channel.id, "time", function(err, reply)
                {
                    if (reply === 1)
                    {
                        db.hdel(message.channel.id, "time");
                    }
                    else return message.reply("this channel does not have super slow-mode. Maybe you already deleted it?");
                })
            }
        }
        else {
            if (command === file.toLowerCase().substring(0, splitter)) {
                const event = new Date(Date.now());
                console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", message.guild.name, "at", event.toUTCString());
                client.commands.get(command).execute(message, args, Discord);
                return;
            }
        }
        
    }
    message.channel.send("Command not found. Type `!kifo help` for list of commands.").catch();
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