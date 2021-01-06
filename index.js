const { timeStamp } = require('console');
const Discord = require('discord.js');
//const config = require('./config.json');

const client = new Discord.Client();

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

client.on('message', message => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;
    if (message.content.includes("@everyone") || message.content.include("@here")) return message.reply("NO PINGS!");
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
        if (!(command === "help")) {
            if (command === file.toLowerCase().substring(0, splitter)) {
                const event = new Date(Date.now());
                console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", event.toUTCString());
                client.commands.get(command).execute(message, args, Discord)
                return;
            }
        }
        else {
            const event = new Date(Date.now());
            console.log(message.author.tag, "issued !kifo", command, "in", message.channel.name, "at", event.toUTCString());
            client.commands.get('help').execute(message, args, Discord);
            return;
        }
    }
    message.channel.send("Command not found. Type `!kifo help` for list of commands.");
});

client.login(process.env.LOGIN_TOKEN);