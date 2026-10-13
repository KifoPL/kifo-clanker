import type { FeatureDefinition } from '../../contracts/features.js';
import { countdownData, createCountdown, handleCountdownInteraction } from './countdown.js';
import { createGiveawaySlash, giveawayData } from './giveaway.js';
import { createScheduledHandlers } from './handlers.js';
import { createPoll, pollData } from './poll.js';
export const scheduledFeature: FeatureDefinition = {
  name: 'scheduled', commandData: [pollData, countdownData, giveawayData],
  create(services) {
    return { slashCommands: [createPoll(services), createCountdown(services), createGiveawaySlash(services)], handlers: createScheduledHandlers(services), onInteraction: interaction => handleCountdownInteraction(services, interaction) };
  },
};
