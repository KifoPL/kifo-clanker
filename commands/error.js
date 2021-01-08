module.exports = {
    name: 'error',
    description: `If this bot encountered error anywhere, please type this command right after. It will ping me (KifoPL#3358).\nUsage: "!kifo error <optional_description>"\nWARNING! If you spam this command for no reason, you will get warned on the same premise as spam pinging. Use only when encountering actual errors.`,
    async execute(message, args, Discord, client) {
        const clientapp = await client.fetchApplication();

        let reply = "**" +  message.author.username + "** has encountered a problem.";
        let kiforeply = reply + ` Link: https://discord.com/channels/${message.channel.guild.id}/${message.channel.id}/${message.id}`;
        if (args[0])
        {
            let problem = "\nProblem:\n> *" + args.join(' ') + "*";
            //reply += problem;
            kiforeply += problem;
        }
        message.channel.send(reply).catch();
        clientapp.owner.send(kiforeply).catch();
        //clientApp.owner.send(reply);
    }
}