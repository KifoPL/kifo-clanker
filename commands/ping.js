module.exports = {
    name: 'ping',
    description: 'This is a ping command :)\nUsage: "!kifo ping"',
    execute(message, args) {
        message.channel.send('pong!').catch();
    }
}