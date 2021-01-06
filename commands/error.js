module.exports = {
    name: 'error',
    description: `If this bot encountered error anywhere, please type this command right after. It will ping me (KifoPL#3358).\nUsage: "!kifo error <optional_description>"\nWARNING! If you spam this command for no reason, you will get warned on the same premise as spam pinging. Use only when encountering actual errors.`,
    execute(message, args) {
        let reply = message.author.username + " has encountered a problem. Check it out <@289119054130839552>.";
        if (args[0]) reply += "\nProblem:\n" + args.join(' ');
        message.channel.send(reply);
    }
}