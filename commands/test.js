module.exports = {
    name: 'test',
    description: 'This is just to test the functionality of the bot, as well as perms settings.',
    slash: 'both',
    category: 'Miscellaneous',
    testOnly: false,
    usage: "!kifo test",
    adminonly: false,
    callback: ({message}) => {
        if (message)
        {
            if (!(message.member.permissions.has("ADMINISTRATOR"))) message.reply("it works, although you're not an Admin.");
            else message.channel.send('works all right!').catch();
        }
        
        let msg = "works! (stay tuned for more slash commands)";
        return msg;
    }
}