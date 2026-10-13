import type { FeatureDefinition } from '../../contracts/features.js';
import { createCleanCommand } from './clean.js';
import { createPermsCommand } from './perms.js';
import { createRemoveCommand } from './remove.js';
import { createRestoreHandler, reconcilePermanentIntents } from './operations.js';
export const moderationFeature: FeatureDefinition = {
  name:'moderation',commandData:[],
  create(services) {
    return {
      prefixCommands:[createCleanCommand(),createPermsCommand(services),createRemoveCommand(services)],
      onReady:() => reconcilePermanentIntents(services),
      handlers:{role_restore:createRestoreHandler(services,'role'),permission_restore:createRestoreHandler(services,'permission')},
    };
  },
};
