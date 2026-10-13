import { EmbedBuilder, PermissionsBitField, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import type { PrefixCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';

export function createRegistryHelp(services: RuntimeServices, prefixCommands: readonly PrefixCommand[], data: readonly RESTPostAPIApplicationCommandsJSONBody[]): PrefixCommand {
  return {
    name: 'help', description: 'List categories, commands, and detailed usage.', category: 'UTILITY',
    usage: ['help [category|command]', '<command> help'],
    async execute(message, args) {
      const prefix = (message.guildId && services.prefixes.get(message.guildId)) || '!kifo ';
      const available = prefixCommands.filter(command => {
        if (command.ownerOnly && !services.ownerIds.has(message.author.id)) return false;
        if (command.guildOnly && !message.guild) return false;
        return !command.permissions || !message.guild || Boolean(message.member?.permissionsIn(message.channelId).has(new PermissionsBitField([...command.permissions])));
      });
      const requested = args[0]?.toLowerCase().replace(/^\//, '');
      const prefixCommand = available.find(command => command.name === requested);
      const applicationCommand = data.find(command => command.name === requested);
      const embed = new EmbedBuilder().setColor(0xa039a0);
      if (prefixCommand) {
        embed.setTitle(`${prefix}${prefixCommand.name}`).setDescription(prefixCommand.description.slice(0, 4_096));
        if (prefixCommand.usage?.length) embed.addFields({ name: 'Usage', value: prefixCommand.usage.join('\n').slice(0, 1_024) });
        if (prefixCommand.permissions?.length) embed.addFields({ name: 'Permissions', value: new PermissionsBitField([...prefixCommand.permissions]).toArray().join(', ') });
      } else if (applicationCommand) {
        embed.setTitle(applicationCommand.name).setDescription(('description' in applicationCommand && applicationCommand.description) || 'Application context menu command.');
        if ('options' in applicationCommand && applicationCommand.options?.length) {
          embed.addFields(applicationCommand.options.slice(0, 25).map(option => ({ name: option.name, value: option.description.slice(0, 1_024) })));
        }
      } else {
        const groups = [...new Set(available.map(command => (command.category || 'UTILITY').toUpperCase()))];
        const category = groups.find(group => group.toLowerCase() === requested);
        if (requested && !category) {
          embed.setDescription(`Command or category not available. Use \`${prefix}help\` to see your commands.`);
        } else {
          embed.setTitle(category ? `${category} commands` : 'Available commands');
          for (const group of category ? [category] : groups) {
            const names = available.filter(command => (command.category || 'UTILITY').toUpperCase() === group).map(command => `\`${prefix}${command.name}\``);
            embed.addFields({ name: group, value: names.join(', ').slice(0, 1_024) || 'None' });
          }
          if (!category) embed.addFields(
            { name: 'Slash commands', value: data.filter(command => !command.type || command.type === 1).map(command => `\`/${command.name}\``).join(', ').slice(0, 1_024) || 'None' },
            { name: 'Context menus', value: data.filter(command => command.type && command.type !== 1).map(command => command.name).join(', ') || 'None' },
          );
          embed.setFooter({ text: `Use ${prefix}help <command> for details.` });
        }
      }
      await message.reply({ embeds: [embed] });
    },
  };
}
