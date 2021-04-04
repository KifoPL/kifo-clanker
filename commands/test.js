module.exports = {
    name: 'test',
    description: 'This is just to test the functionality of the bot, as well as perms settings.',
    usage: "!kifo test",
    adminonly: false,
    execute(message, args)
    {
        if (message.member.permissions.has("ADMINISTRATOR")) return message.reply("works fine, Mr. Admin!");
        else return message.reply("it works, regular person.");
    }
}