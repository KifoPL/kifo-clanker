module.exports = {
    name: 'ping',
    description: 'This is a ping command :)',
    usage: "!kifo ping",
    adminonly: false,
    execute(message, args) {
        message.channel.send('pong!').catch();
    }
}