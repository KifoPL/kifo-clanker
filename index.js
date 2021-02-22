const { timeStamp } = require('console');
const Discord = require('discord.js');
//const config = require('./config.json');

const client = new Discord.Client();
const db = require('redis').createClient(process.env.REDIS_URL);
db.on('connect', function() {
    console.log('Database online!');
})
var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

const prefix = '!kifo ';

const fs = require('fs');
const { SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION } = require('constants');

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
});

//USED BY REACT COMMAND
let reactreturn;

client.on('message', message => {
    //IF CORRECT CHANNEL, REACT
    db.exists(message.channel.id, function(err, reply)
    {
        if (reply === 1)
        {
            if (!message.content.startsWith(prefix) && !message.author.bot)
            {
                db.lrange(message.channel.id, 0, -1, function(err, reply) {
                for (i = 0; i < reply.length; i++) 
                {
                    message.react(reply[i]).catch();
                }
                });
            }
        }
    })
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    if (message.channel.id == "707650931809976391") return;
    if (message.mentions.roles.firstKey() != undefined) return message.reply("no roles in commands!");
    if (message.mentions.everyone) return message.reply("don't even try pinging...");
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

client.on('guildMemberAdd', member => {
    console.log("did default code work?");
    // Send the message to a designated channel on a server:
    const channel = member.guild.channels.cache.find(ch => ch.name === 'shinies-incoming');
    // Do nothing if the channel wasn't found on this server
    if (!channel) return;
    // Send the message, mentioning the member
    channel.send(`Welcome to the server, ${member}`);
});

//Code for adding WoofWoof role to members added by WoofWoofWolffe
client.on('guildMemberAdd', member => {
    console.log('did it work?');
    member.guild.fetchInvites().then(invites => {
        console.log('test1');
        let foundinvite;
        if (invites.find(invite => invite.targetUser == member.user) != undefined)
        {
            foundinvite = invite;
            console.log(foundinvite.inviter.id);
            if (foundinvite.inviter.id == "376956266293231628")
            {
                member.roles.add(member.guild.roles.cache.find(role => role.id == '746558695139180625')).catch(console.error);
            }
        }
    }).catch(console.error);
})

client.login(process.env.LOGIN_TOKEN);