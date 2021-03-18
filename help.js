module.exports = {
    name: 'help',
    description: "This command lists all commands. Type !kifo help <command> to see help for specific command.",
    usage: "!kifo help <optional_command>",
    adminonly: false,
    execute(message, args, Discord) {
        const fs = require('fs');
        const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
        const client = message.client;
        let command = {};
        var AmIAdmin = false;
        if (message.member.permissions.has("ADMINISTRATOR")) AmIAdmin = true;

        //!kifo help <command>
        if (args[0])
        {
            if (args[0] == 'help')
            {
                const newEmbed = new Discord.MessageEmbed()
            .setColor('a039a0')
            .setTitle(args[0])
            .setDescription(this.description)
            .addField("Usage:", this.usage);
            message.channel.send(newEmbed);
            return;
            }
            //This was clogging logs, leaving for DEBUG purposes
            //console.log(commandFiles);
         for (const file of commandFiles) {
            command = require(`./commands/${file}`);
            const splitter = (file.length - 3);
            if (args[0] == file.toLowerCase().substring(0, splitter))
            {
            const newEmbed = new Discord.MessageEmbed()
            .setColor('a039a0')
            .setTitle(command.name)
            .setDescription(command.description)
            .addField("Usage:", command.usage);
            message.channel.send(newEmbed);
            return;
            }
         }
         message.channel.send("Command not found. Type !kifo help for list of commands.");
         return;
        }
        var Field = {name: "name", value: "description"};
        var FieldArr = [];
        Field.name = this.name;
        Field.value = this.description;
        FieldArr.push(Field);
        var Field = {};
        let i = 0;
        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            //Lists everything for admins and only user accessible commands otherwise.
            if (!command.adminonly || AmIAdmin)
            {
                var Field = {};
                Field.name = command.name;
                Field.value = command.description;
                FieldArr.push(Field);
                i++;
            }
        }
        const newEmbed = new Discord.MessageEmbed()
        .setColor('a039a0')
        .setTitle('List of ' + i + 'commands:')
        .setDescription('Bot is created and developed solely by @KifoPL#3358. For checking out repo, click on this embed.')
        .setURL('https://github.com/KifoPL/kifo-clanker')
        .addFields(FieldArr);

        message.channel.send(newEmbed);
    }
}