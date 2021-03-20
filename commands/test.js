module.exports = {
    name: 'test',
    description: 'This is just to test the functionality of the bot, as well as perms settings.',
    usage: "!kifo test",
    adminonly: false,
    execute(message, args) {
        if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("it works, although you're not an Admin.");
        message.channel.send('Works all right!').catch();
    }
}