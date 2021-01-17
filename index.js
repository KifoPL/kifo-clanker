const { timeStamp } = require('console');
const Discord = require('discord.js');
//const config = require('./config.json');

const client = new Discord.Client();
const db = require('redis').createClient(process.env.REDIS_URL);
var Redis = require('ioredis');
var redis = new Redis(process.env.REDIS_URL);

const prefix = '!kifo ';

const fs = require('fs');

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
//const channellist = new Discord.Collection();
//const channellistemotes = new Map;

client.on('message', message => {
    if (db.get(message.channel.id) != null)
    {
        if (!message.content.startsWith(prefix) && !message.author.bot)
        {
            for (i = 0; i < db.get(message.channel.id).length; i++)
            {
                if (message.deleted) return;
                message.react(db.get(message.channel.id)[i]);
            }
        }
    }
    // if (channellist.find(channel => message.channel == channel) != undefined)
    // {
    //     if (!message.content.startsWith(prefix) && !message.author.bot)
    //     {
    //         for (i = 0; i < channellistemotes.get(message.channel.id).length; i++)
    //         {
    //             if (message.deleted) return;
    //             message.react(channellistemotes.get(message.channel.id)[i]);
    //         }
    //     }
    // }
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    if (message.mentions.roles.firstKey() != undefined) return message.reply("no roles in commands!");
    if (message.mentions.everyone) return message.reply("don't even try pinging...");
    const args = message.content.slice(prefix.length).split(/ +/);
    const command = args.shift().toLowerCase();
    // if (!(message.member.permissions.has("ADMINISTRATOR"))) {
    //     message.channel.send("Sorry, this is Admin only bot.");
    //     const event = new Date(Date.now());
    //     console.log(message.author.tag, "tried to issue !kifo", command, "in", message.channel.name, "at", event.toUTCString());
    //     return;
    // }
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
            reactreturn = client.commands.get(command).execute(message, args, Discord, client);
            if (reactreturn[0] == "ON")
            {
                //channellist.set(message.channel.id, message.channel);
                db.set(message.channel.id, reactreturn.pop());
            }
            else if (reactreturn[1] == "OFF")
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

client.login(process.env.LOGIN_TOKEN);