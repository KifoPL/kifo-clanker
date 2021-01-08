module.exports = {
    name: 'test',
    description: 'This is just to test the funcionality of the bot, as well as perms settings.\nUsage: "!kifo test"',
    execute(message, args) {
        if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("it works, although you're not an Admin.");
        message.channel.send('Works all right!').catch();
    }
}