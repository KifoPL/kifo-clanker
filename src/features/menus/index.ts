import type { FeatureDefinition } from '../../contracts/features.js';
import { PermanentJobError } from '../../scheduler/index.js';
import { menuCommand } from './menu.js';
import { isMenuEmoji, MenuService } from './service.js';

function payload(value: unknown): { messageId: string; userId?: string } {
  if (!value || typeof value !== 'object' || !('messageId' in value) || typeof value.messageId !== 'string') throw new PermanentJobError('Invalid menu job payload');
  if ('userId' in value && typeof value.userId !== 'string') throw new PermanentJobError('Invalid menu participant payload');
  return { messageId: value.messageId, ...('userId' in value ? { userId: value.userId as string } : {}) };
}

export const menusFeature: FeatureDefinition = {
  name: 'menus', commandData: [],
  create(services) {
    const menus = new MenuService(services);
    return {
      prefixCommands: [menuCommand(services, menus)],
      hydrate: () => menus.hydrate(),
      onReady: () => menus.ready(),
      reconcile: () => menus.enqueueReconciliation(),
      onReaction: async (reaction, user, added) => {
        if (user.bot) return;
        const menu = menus.menus.get(reaction.message.id);
        if (!menu || !isMenuEmoji(menu.kind, reaction.emoji.id ?? reaction.emoji.name)) return;
        await menus.participant(menu.message_id, user.id, added);
      },
      onMessageDelete: async message => { if (menus.menus.has(message.id)) await menus.expire(message.id); },
      handlers: {
        'menu.expire': async (job, signal) => { await menus.expire(payload(job.payload).messageId, signal); },
        'menu.reconcile': async (job, signal) => { await menus.ready(payload(job.payload).messageId, signal); },
        'menu.participant': async (job, signal) => {
          const data = payload(job.payload);
          if (!data.userId) throw new PermanentJobError('Missing menu participant');
          await menus.runParticipant(data.messageId, data.userId, signal);
        },
      },
    };
  },
};
