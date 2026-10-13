import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';

export const helpData = new SlashCommandBuilder().setName('help').setDescription('List slash commands or show command details.')
  .addStringOption(option => option.setName('command').setDescription('The command to describe.'))
  .addStringOption(option => option.setName('category').setDescription('List commands in a category.').addChoices(
    {name:'Management',value:'management'}, {name:'Utility',value:'utility'}, {name:'Fun',value:'fun'}, {name:'Debug',value:'debug'})).toJSON();

const owners = new Set(['serverlist','reload','deploy','cmdlist']);
export function commandCategory(name: string): string {
  if (['clean','perms','remove','menu','list','stats','top'].includes(name)) return 'management';
  if (['cringe','howgay','iq','pp','stfu','urmum','reverse'].includes(name)) return 'fun';
  if (['ping','test','error',...owners].includes(name)) return 'debug';
  return 'utility';
}
export function createRegistryHelp(services: RuntimeServices, getData: () => readonly RESTPostAPIApplicationCommandsJSONBody[]): SlashCommand {
  return {data:helpData, async execute(interaction) {
    const available = getData().filter(command => {
      if (owners.has(command.name) && !services.ownerIds.has(interaction.user.id)) return false;
      if (!interaction.guildId && command.dm_permission === false) return false;
      const context = interaction.guildId ? InteractionContextType.Guild : InteractionContextType.BotDM;
      if (command.contexts && !command.contexts.includes(context)) return false;
      const permissions = command.default_member_permissions;
      return !permissions || !interaction.guildId || Boolean(interaction.memberPermissions?.has(BigInt(permissions)));
    });
    const requested = interaction.options.getString('command')?.toLowerCase().replace(/^\//, '');
    const category = interaction.options.getString('category');
    const command = available.find(item => item.name === requested);
    const embed = new EmbedBuilder().setColor(0xa039a0);
    if (command) {
      embed.setTitle(command.type && command.type !== 1 ? command.name : '/' + command.name)
        .setDescription(('description' in command && command.description) || 'Context menu command.');
      if ('options' in command && command.options?.length) embed.addFields(command.options.map(option => ({name:option.name,value:option.description})));
    } else if (requested) embed.setDescription('Command unavailable. Use /help to see your available slash commands.');
    else {
      embed.setTitle(category ? category + ' commands' : 'Available slash commands');
      for (const group of category ? [category] : ['management','utility','fun','debug']) {
        const names = available.filter(item => (!item.type || item.type === 1) && commandCategory(item.name) === group).map(item => '/' + item.name);
        embed.addFields({name:group,value:names.join(', ') || 'None'});
      }
      if (!category) embed.addFields({name:'Context menus',value:available.filter(item => item.type && item.type !== 1).map(item => item.name).join(', ') || 'None'});
      embed.setFooter({text:'Use /help command:<name> for details. Text prefixes are disabled.'});
    }
    await interaction.reply({embeds:[embed],flags:MessageFlags.Ephemeral});
  }};
}
