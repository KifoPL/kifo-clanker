import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import type { RuntimeServices } from './contracts/features.js';
import { slashCommands } from './commands/index.js';
import { automationFeature } from './features/automation/index.js';
import { moderationFeature } from './features/moderation/index.js';
import { menusFeature } from './features/menus/index.js';
import { utilitiesFeature } from './features/utilities/index.js';
import { entertainmentFeature } from './features/entertainment/index.js';
import { scheduledFeature } from './features/scheduled/index.js';
import { coreFeature } from './features/core/index.js';
import { createRegistryHelp } from './features/core/help.js';

export const featureDefinitions = [automationFeature, moderationFeature, menusFeature, utilitiesFeature, entertainmentFeature, scheduledFeature, coreFeature] as const;
export const applicationCommandData: readonly RESTPostAPIApplicationCommandsJSONBody[] = [
  ...slashCommands.map(command => command.data), ...featureDefinitions.flatMap(feature => [...feature.commandData]),
];

export function createRegistry(services: RuntimeServices) {
  const features = featureDefinitions.map(feature => feature.create(services));
  const prefix = features.flatMap(feature => [...(feature.prefixCommands ?? [])]);
  const slash = [...slashCommands, ...features.flatMap(feature => [...(feature.slashCommands ?? [])])];
  const context = features.flatMap(feature => [...(feature.contextCommands ?? [])]);
  const handlers = Object.fromEntries(features.flatMap(feature => Object.entries(feature.handlers ?? {})));
  const names = features.flatMap(feature => Object.keys(feature.handlers ?? {}));
  if (new Set(names).size !== names.length) throw new Error('Duplicate scheduled handler');
  prefix.push(createRegistryHelp(services, prefix, applicationCommandData));
  for (const names of [prefix.map(command => command.name), slash.map(command => command.data.name), context.map(command => command.data.name)]) {
    if (new Set(names).size !== names.length) throw new Error('Duplicate command registry entry');
  }
  return { features, prefix, slash, context, handlers };
}
