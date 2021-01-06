module.exports = {
    name: 'cringe',
    description: `Express your feelings to another discord user with this beautiful poem.\nUsage: "!kifo cringe <optional_ping>"`,
    execute(message, args) {
        let reply = "Roses are red,\nViolets are blue,\nYou are cringe\nSeriously. You're cringe.";
        if (args[0]) if (!isNaN(args[0])) reply = "<@" + args[0] + ">\n" + reply; else reply = args[0] + "\n" + reply;
        message.channel.send(reply);
    }
}