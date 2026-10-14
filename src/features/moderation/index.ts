import type { FeatureDefinition } from '../../contracts/features.js';
import { invocationCommand } from '../../discord/invocation.js';
import { cleanData, createCleanCommand } from './clean.js';
import { permsData, createPermsCommand } from './perms.js';
import { removeData, createRemoveCommand } from './remove.js';
import { createRestoreHandler, reconcilePermanentIntents } from './operations.js';
export const moderationFeature: FeatureDefinition = {
  name:'moderation',commandData:[cleanData,permsData,removeData],
  create(services) {
    return {
      slashCommands:[
        invocationCommand(cleanData,createCleanCommand(),interaction => {
          const channel = interaction.options.getChannel('channel');
          return interaction.options.getBoolean('all') ? ['all',...(channel ? [channel.id] : [])] : channel ? [channel.id] : [];
        },services),
        invocationCommand(permsData,createPermsCommand(services),interaction => {
          const action = interaction.options.getSubcommand();
          if (action === 'info') return ['info'];
          const targets = [interaction.options.getUser('user')?.id,interaction.options.getRole('role')?.id].filter((id): id is string => Boolean(id));
          const channel = interaction.options.getChannel('channel')?.id ?? '';
          if (action === 'report') return ['report',channel,...targets];
          const bulk = (interaction.options.getString('targets') ?? '').split(/[\s,]+/u).filter(Boolean);
          return ['set',interaction.options.getString('state',true),interaction.options.getString('permission',true),channel,interaction.options.getString('duration') ?? '',...targets,...bulk];
        },services),
        invocationCommand(removeData,createRemoveCommand(services),interaction => {
          const duration = interaction.options.getString('duration');
          return [interaction.options.getUser('member',true).id,interaction.options.getRole('role',true).id,...(duration ? [duration] : [])];
        },services),
      ],
      onReady:() => reconcilePermanentIntents(services),
      handlers:{role_restore:createRestoreHandler(services,'role'),permission_restore:createRestoreHandler(services,'permission')},
    };
  },
};
