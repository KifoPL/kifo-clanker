const Discord = require('discord.js');

module.exports = {
    name: 'ping',
    slash: 'both',
    category: 'Miscellaneous',
    testOnly: false,
    description: 'This is a ping command :)',
    usage: "!kifo ping",
    adminonly: false,
    callback: ({message}) => {
        if (message) message.channel.send('pong!').catch();
        const Embed = new Discord.MessageEmbed()
        .setAuthor("Kifo Clanker™", null, "https://github.com/KifoPL/kifo-clanker/wiki")
        .setColor('a039a0')
        .setTitle("Ping...")
        .setDescription("...pong!")
        return Embed;
    },
}