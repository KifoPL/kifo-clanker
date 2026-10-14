import type { FeatureDefinition } from '../../contracts/features.js';
import { cringe } from './cringe.js';
import { howgay } from './howgay.js';
import { iq } from './iq.js';
import { pp } from './pp.js';
import { stfu } from './stfu.js';
import { guide } from './guide.js';
import { bookmarkData, createBookmark } from './bookmark.js';
import { createError, errorData } from './error.js';
import { createUrmum, urmumData } from './urmum.js';
const commands = [cringe, howgay, iq, pp, stfu, guide];
export const entertainmentFeature: FeatureDefinition = {
  name: 'entertainment',
  commandData: [...commands.map(command => command.data), bookmarkData, errorData, urmumData],
  create(services) { return { slashCommands: [...commands, createBookmark(services), createError(services), createUrmum(services)] }; },
};
