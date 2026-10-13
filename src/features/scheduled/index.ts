import type { FeatureDefinition } from '../../contracts/features.js';
import { countdownData, createCountdown, handleCountdownInteraction } from './countdown.js';
import { createGiveaway } from './giveaway.js';
import { createScheduledHandlers } from './handlers.js';
import { createPoll, pollData } from './poll.js';
export const scheduledFeature: FeatureDefinition = {
  name: 'scheduled', commandData: [pollData, countdownData],
  create(services) {
    return { prefixCommands: [createGiveaway(services)], slashCommands: [createPoll(services), createCountdown(services)], handlers: createScheduledHandlers(services), onInteraction: interaction => handleCountdownInteraction(services, interaction) };
  },
};
