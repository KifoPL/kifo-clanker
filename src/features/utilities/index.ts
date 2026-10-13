import type { FeatureDefinition } from '../../contracts/features.js';
import { invocationCommand } from '../../discord/invocation.js';
import { createDetectLanguage, detectLanguageData } from './detect-language.js';
import { createLang, langData } from './lang.js';
import { list, listData } from './list.js';
import { prefix, prefixData } from './prefix.js';
import { save, saveData } from './save.js';
import { canDeleteUtilityDm } from './shared.js';
import { stats, statsData } from './stats.js';
import { createTodo, todoData } from './todo.js';
import { createTop, topData } from './top.js';
import { userStatsCommand, userStatsData } from './user-stats.js';

export const utilitiesFeature: FeatureDefinition = Object.freeze<FeatureDefinition>({
  name: 'utilities',
  commandData: Object.freeze([listData, statsData, topData, langData, prefixData, todoData, detectLanguageData, saveData, userStatsData]),
  create(services) {
    const top = createTop();
    return {
      slashCommands: [
        invocationCommand(listData, list, interaction => {
          const mode = interaction.options.getSubcommand();
          if (mode === 'server') return [];
          if (mode === 'user') return [interaction.options.getUser('member')?.id ?? interaction.user.id];
          const roles = [interaction.options.getRole('role', true).id, ...(interaction.options.getString('roles')?.trim().split(/\s+/u).filter(Boolean) ?? [])];
          const channel = interaction.options.getChannel('channel');
          return channel ? [channel.id, ...roles] : roles;
        }, services),
        invocationCommand(statsData, stats, interaction => {
          const member = interaction.options.getUser('member');
          const role = interaction.options.getRole('role');
          return [...(member ? [member.id] : []), ...(role ? [role.id] : [])];
        }, services),
        invocationCommand(topData, top.command, interaction => [String(interaction.options.getInteger('winners', true)), interaction.options.getString('duration', true), interaction.options.getChannel('channel', true).id, interaction.options.getString('emoji', true)], services, true),
        invocationCommand(langData, createLang(services), interaction => [interaction.options.getString('message', true)], services),
        invocationCommand(prefixData, prefix, () => [], services),
        invocationCommand(todoData, createTodo(services), interaction => {
          const text = interaction.options.getString('text');
          const link = interaction.options.getString('link');
          return [link ?? '', text ?? ''];
        }, services),
      ],
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
