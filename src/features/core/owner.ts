import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ComponentType, SlashCommandBuilder } from 'discord.js';
import { randomUUID } from 'node:crypto';
import type { InvocationCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { invocationCommand } from '../../discord/invocation.js';

export const ownerCommandData = ['reload','serverlist','cmdlist','deploy'].map(name => {
  const builder = new SlashCommandBuilder().setName(name).setDescription('Bot owner only: ' + ({reload:'Reload cached settings.',serverlist:'List connected servers.',cmdlist:'List registered commands.',deploy:'Review and confirm command registration/removal.'}[name] ?? name));
  if (name === 'deploy') builder.setDMPermission(false).addStringOption(option => option.setName('operation').setDescription('Registration or removal scope.').setRequired(true).addChoices(...['guild','global','both','delete-guild','delete-global','delete-both'].map(value => ({name:value,value}))));
  return builder.toJSON();
});
export function createOwnerSlashCommands(services: RuntimeServices) {
  return createOwnerCommands(services).map(command => invocationCommand(ownerCommandData.find(data => data.name === command.name)!, command, interaction => command.name === 'deploy' ? [interaction.options.getString('operation',true)] : [], services));
}

export function createOwnerCommands(services: RuntimeServices): InvocationCommand[] {
  return [
    {
      name: 'reload', description: 'Reload cached configuration after operator database changes.', ownerOnly: true, category: 'DEBUG',
      async execute(message) {
        if (!services.reload) throw new Error('Configuration reload is unavailable');
        await services.reload();
        await message.reply('Cached settings reloaded. Menu reconciliation will run through the scheduler.');
      },
    },
    {
      name: 'serverlist', description: 'List the servers this bot has joined.', ownerOnly: true, category: 'DEBUG',
      async execute(message) {
        const text = services.client.guilds.cache.map(guild => `${guild.name}\t${guild.id}\t${guild.memberCount} members`).join('\n');
        await message.reply({ files: [new AttachmentBuilder(Buffer.from(text || 'No servers.'), { name: 'servers.txt' })] });
      },
    },
    {
      name: 'cmdlist', description: 'List deployed application commands in this server and globally.', ownerOnly: true, category: 'DEBUG',
      async execute(message) {
        const application = services.client.application;
        if (!application) throw new Error('Discord application is not ready');
        const [global, guild] = await Promise.all([
          application.commands.fetch(),
          message.guild ? application.commands.fetch({ guildId: message.guild.id }) : Promise.resolve(undefined),
        ]);
        const text = [
          ...global.map(command => `global\t${command.name}\t${command.id}`),
          ...(guild?.map(command => `guild\t${command.name}\t${command.id}`) ?? []),
        ].join('\n');
        await message.reply({ files: [new AttachmentBuilder(Buffer.from(text || 'No commands deployed.'), { name: 'commands.txt' })] });
      },
    },
    {
      name: 'deploy', description: 'Review and confirm application command registration or removal.', ownerOnly: true, guildOnly: true, category: 'DEBUG',
      usage: ['deploy — choose this server, global registration, or removal, then confirm'],
      async execute(message, args) {
        if (!services.ownerIds.has(message.author.id) || !message.guild) throw new Error('Bot owner in a server required');
        const application = services.client.application;
        if (!application) throw new Error('Discord application is not ready');
        if (!services.applicationCommands?.length) throw new Error('Application command metadata is unavailable');
        const token = randomUUID();
        const operations = ['guild', 'global', 'both', 'delete-guild', 'delete-global', 'delete-both'] as const;
        const choices = operations.filter(choice => choice === args[0]);
        if (choices.length !== 1) throw new Error('Choose a valid deployment operation');
        const ids = new Map(choices.map(choice => [`deploy:${token}:${choice}`, choice]));
        const buttons = choices.map(choice => new ButtonBuilder().setCustomId(`deploy:${token}:${choice}`)
          .setLabel(choice).setStyle(choice.startsWith('delete') ? ButtonStyle.Danger : ButtonStyle.Primary));
        const prompt = await message.reply({
          content: `Register ${services.applicationCommands.length} commands or remove commands? Global changes affect every server. Only you can confirm within 30 seconds.`,
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)],
        });
        try {
          const interaction = await prompt.awaitMessageComponent({
            componentType: ComponentType.Button, time: 30_000,
            filter: item => item.user.id === message.author.id && item.message.id === prompt.id && ids.has(item.customId),
          });
          const choice = ids.get(interaction.customId);
          if (!choice || !services.ownerIds.has(interaction.user.id)) throw new Error('Invalid deployment confirmation');
          await interaction.deferUpdate();
          const remove = choice.startsWith('delete');
          const data = remove ? [] : [...services.applicationCommands];
          if (choice.endsWith('guild') || choice.endsWith('both')) await application.commands.set(data, message.guild.id);
          if (choice.endsWith('global') || choice.endsWith('both')) await application.commands.set(data);
          await message.editReply(prompt.id, { content: `${remove ? 'Removed' : 'Registered'} commands: ${choice}.`, components: [] });
        } catch (error) {
          await message.editReply(prompt.id, { content: 'Deployment confirmation expired or the operation failed. No further changes will be attempted.', components: [] });
          // A completed first scope cannot be rolled back automatically if the second scope fails.
          services.logger.error('Owner command deployment did not complete', error);
        }
      },
    },
  ];
}
