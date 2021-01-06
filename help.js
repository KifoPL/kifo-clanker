module.exports = {
    name: 'help',
    description: "This command lists all commands. Type !kifo help <command> to see help for specific command.",
    execute(message, args, Discord) {
        const fs = require('fs');
        const commandFiles = fs.readdirSync('./commands/').filter(file => file.endsWith('.js'));
        const client = message.client;
        let command = {};
        if (args[0])
        {
            if (args[0] == 'help')
            {
                const newEmbed = new Discord.MessageEmbed()
            .setColor('a039a0')
            .setTitle(args[0])
            .setDescription(this.description);
            message.channel.send(newEmbed);
            return;
            }
            console.log(commandFiles);
            let i = 0;
         for (const file of commandFiles) {
            command = require(`./commands/${file}`);
            const splitter = (file.length - 3);
            client.commands.set(command.name, command);
            if (args[0] == file.toLowerCase().substring(0, splitter))
            {
            const newEmbed = new Discord.MessageEmbed()
            .setColor('a039a0')
            .setTitle(command.name)
            .setDescription(command.description);
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
        //console.log('1');
        //console.log(Field);
        var Field = {};
        //console.log('2');
        //console.log(FieldArr[0]);
        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            const splitter = (file.length - 3);
            client.commands.set(command.name, command);
            var Field = {};
            Field.name = command.name;
            Field.value = command.description;
            FieldArr.push(Field);
            //console.log('3');
            //console.log(Field);
        }
        //console.log('4');
        //console.log(FieldArr);
        const newEmbed = new Discord.MessageEmbed()
        .setColor('a039a0')
        .setTitle('List of commands:')
        .addFields(FieldArr);

        message.channel.send(newEmbed);
    }
}