import type { FeatureDefinition } from '../../contracts/features.js';
import { createDetectLanguage, detectLanguageData } from './detect-language.js';
import { createLang } from './lang.js';
import { list } from './list.js';
import { createPrefix } from './prefix.js';
import { save, saveData } from './save.js';
import { canDeleteUtilityDm } from './shared.js';
import { stats } from './stats.js';
import { test } from './test.js';
import { createTodo } from './todo.js';
import { createTop } from './top.js';
import { userStatsCommand, userStatsData } from './user-stats.js';

export const utilitiesFeature: FeatureDefinition = Object.freeze<FeatureDefinition>({
  name: 'utilities',
  commandData: Object.freeze([detectLanguageData, saveData, userStatsData]),
  create(services) {
    const top = createTop();
    return {
      prefixCommands: [list, stats, top.command, createLang(services), createPrefix(services), createTodo(services), test],
      contextCommands: [createDetectLanguage(services), save, userStatsCommand],
      onInteraction: top.onInteraction,
      close: top.close,
      async onReaction(reaction, user, added) {
        if (!added || user.bot) return;
        const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
        if (!canDeleteUtilityDm(message, user.id)) return;
        if (message.embeds[0]?.author?.name === 'TODO' || reaction.emoji.name === '❌' || reaction.emoji.id === '857976926542757910') await message.delete();
      },
    };
  },
});
