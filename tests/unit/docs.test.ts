import assert from 'node:assert/strict';
import test from 'node:test';
import { ApplicationCommandType, SlashCommandBuilder } from 'discord.js';
import { renderCommandReference } from '../../scripts/generate-docs.js';

test('command docs render every nested option path, required type, choice and bound', () => {
  const command = new SlashCommandBuilder().setName('sample').setDescription('Sample command.')
    .addSubcommandGroup(group => group.setName('group').setDescription('Sample group.')
      .addSubcommand(sub => sub.setName('run').setDescription('Run a sample.')
        .addIntegerOption(option => option.setName('count').setDescription('A number | with a separator.').setRequired(true).setMinValue(1).setMaxValue(10))
        .addStringOption(option => option.setName('mode').setDescription('Choose a mode.').addChoices({ name: 'First mode', value: 'first' }).setMaxLength(100))))
    .toJSON();
  const page = renderCommandReference([command, { name: 'save', type: ApplicationCommandType.Message }]);
  assert.match(page, /1 slash commands and 1 context menu actions/);
  assert.match(page, /`\/sample group run`/);
  assert.match(page, /\| `count` \| Integer \| Yes \| A number \\\| with a separator\./);
  assert.match(page, /Minimum: 1 · Maximum: 10/);
  assert.match(page, /First mode \(`first`\).*Maximum length: 100/);
  assert.match(page, /Target: \*\*message\*\*/);
  assert.match(page, /permalink: \/docs\/commandList/);
});
