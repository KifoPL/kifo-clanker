import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { randomUUID } from 'node:crypto';
import type { PrefixCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { applicationCommandData } from '../../registry.js';

export function createOwnerCommands(services: RuntimeServices): PrefixCommand[] {
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
      async execute(message) {
        if (!services.ownerIds.has(message.author.id) || !message.guild) throw new Error('Bot owner in a server required');
        const application = services.client.application;
        if (!application) throw new Error('Discord application is not ready');
        const token = randomUUID();
        const choices = ['guild', 'global', 'both', 'delete-guild', 'delete-global', 'delete-both'] as const;
        const ids = new Map(choices.map(choice => [`deploy:${token}:${choice}`, choice]));
        const buttons = choices.map(choice => new ButtonBuilder().setCustomId(`deploy:${token}:${choice}`)
          .setLabel(choice).setStyle(choice.startsWith('delete') ? ButtonStyle.Danger : ButtonStyle.Primary));
        const prompt = await message.reply({
          content: `Register ${applicationCommandData.length} commands or remove commands? Global changes affect every server. Only you can confirm within 30 seconds.`,
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 3)), new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(3))],
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
          const data = remove ? [] : [...applicationCommandData];
          if (choice.endsWith('guild') || choice.endsWith('both')) await application.commands.set(data, message.guild.id);
          if (choice.endsWith('global') || choice.endsWith('both')) await application.commands.set(data);
          await prompt.edit({ content: `${remove ? 'Removed' : 'Registered'} commands: ${choice}.`, components: [] });
        } catch (error) {
          await prompt.edit({ content: 'Deployment confirmation expired or the operation failed. No further changes will be attempted.', components: [] });
          // A completed first scope cannot be rolled back automatically if the second scope fails.
          services.logger.error('Owner command deployment did not complete', error);
        }
      },
    },
  ];
}
