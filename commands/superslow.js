module.exports = {
    name: 'superslow',
    description: `Enable Super slow-mode (longer than 6 hours) for channels where you need it.`,
	usage: `!kifo superslow <time_period> [0 to turn it off]`,
    adminonly: true,
    execute(message, args) {
        //This is for timestamps
        const ms = require(`ms`);
        let shortest = ms('10s');
        let longest = ms('14d')
        if (!(message.member.permissions.has("ADMINISTRATOR"))) return message.reply("This is ADMIN ONLY command.");
        if (!args[0]) return message.reply("insufficient arguments!");
        if (isNaN(ms(args[0]))) return message.reply("incorrect time period. Please specify correct time period.");
        if (ms(args[0]) < shortest && ms(args[0]) != 0) return message.reply("Just use normal Discord slow-mode, no need to waste my bot's resources.");
        if (ms(args[0]) > longest) return message.reply("incorrect amount of time. For the command to work, please input period of time that is between " + ms(shortest, {long : true}) + " and " + ms(shortest, {long : true}) + ".");
        let isOff = false;
        if (ms(args[0]) == 0) isOff = true;
        let params = [isOff, ms(args[0])];
        return params;
        //for every channel it works it saves userid - timestamp pair
        //Make sure you don't add superslowmode to the channel it already exists.
        //Can't superslowmode admins.
    }
}