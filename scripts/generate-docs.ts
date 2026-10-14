import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ApplicationCommandOptionType, ApplicationCommandType, type APIApplicationCommandOption, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { applicationCommandData } from '../src/registry.js';

const escape = (text: string): string => text.replaceAll('|', '\\|').replace(/\r?\n/gu, ' ');
const inline = (text: string | number): string => '`' + String(text).replaceAll('`', '\\`').replaceAll('|', '\\|') + '`';
const anchor = (name: string): string => name.toLowerCase().replaceAll(' ', '-');
const typeNames: Record<number, string> = {
  [ApplicationCommandOptionType.String]: 'Text', [ApplicationCommandOptionType.Integer]: 'Integer',
  [ApplicationCommandOptionType.Boolean]: 'True / false', [ApplicationCommandOptionType.User]: 'Member',
  [ApplicationCommandOptionType.Channel]: 'Channel', [ApplicationCommandOptionType.Role]: 'Role',
  [ApplicationCommandOptionType.Mentionable]: 'Member or role', [ApplicationCommandOptionType.Number]: 'Number',
  [ApplicationCommandOptionType.Attachment]: 'Attachment',
};

function optionDetails(option: APIApplicationCommandOption): string {
  const details: string[] = [];
  if ('choices' in option && option.choices?.length) details.push('Choices: ' + option.choices.map(choice => `${escape(choice.name)} (${inline(choice.value)})`).join(', '));
  if ('min_value' in option && option.min_value !== undefined) details.push(`Minimum: ${option.min_value}`);
  if ('max_value' in option && option.max_value !== undefined) details.push(`Maximum: ${option.max_value}`);
  if ('min_length' in option && option.min_length !== undefined) details.push(`Minimum length: ${option.min_length}`);
  if ('max_length' in option && option.max_length !== undefined) details.push(`Maximum length: ${option.max_length}`);
  if ('channel_types' in option && option.channel_types?.length) details.push('Channel types: ' + option.channel_types.map(type => inline(({ 0: 'text', 2: 'voice', 4: 'category', 5: 'announcement', 10: 'announcement thread', 11: 'public thread', 12: 'private thread', 13: 'stage', 15: 'forum', 16: 'media' } as Record<number, string>)[type] ?? type)).join(', '));
  return details.join(' · ');
}

function renderOptions(options: readonly APIApplicationCommandOption[], path: string): string[] {
  const sections: string[] = [];
  const inputs = options.filter(option => option.type !== ApplicationCommandOptionType.Subcommand && option.type !== ApplicationCommandOptionType.SubcommandGroup);
  if (inputs.length) {
    sections.push('| Option | Type | Required | Description | Choices and limits |', '|---|---|---|---|---|');
    for (const option of inputs) sections.push(`| ${inline(option.name)} | ${typeNames[option.type] ?? option.type} | ${'required' in option && option.required ? 'Yes' : 'No'} | ${escape(option.description)} | ${optionDetails(option) || '—'} |`);
    sections.push('');
  }
  for (const option of options) {
    if (option.type !== ApplicationCommandOptionType.Subcommand && option.type !== ApplicationCommandOptionType.SubcommandGroup) continue;
    const nestedPath = `${path} ${option.name}`;
    sections.push(`#### ${inline(nestedPath)}`, '', option.description, '');
    if (option.options?.length) sections.push(...renderOptions(option.options, nestedPath));
    else sections.push('No options.', '');
  }
  return sections;
}

export function renderCommandReference(commands: readonly RESTPostAPIApplicationCommandsJSONBody[]): string {
  const slash = commands.filter(command => !command.type || command.type === ApplicationCommandType.ChatInput).sort((a, b) => a.name.localeCompare(b.name));
  const contexts = commands.filter(command => command.type && command.type !== ApplicationCommandType.ChatInput).sort((a, b) => a.name.localeCompare(b.name));
  const sections = ['---', 'title: Command reference', 'permalink: /docs/commandList/', '---', '{% include docs-nav.html %}', '', '# Command reference', '', `${slash.length} slash commands and ${contexts.length} context menu actions, generated from the bot’s current registry.`, '', 'Type `/` in Discord and choose Kifo Clanker. Options marked required must be provided; choose listed values in Discord’s command picker.', '', '## Slash commands', '', slash.map(command => `[${inline('/' + command.name)}](#${anchor(command.name)})`).join(' · '), ''];
  for (const command of slash) {
    sections.push(`### /${command.name}`, '', 'description' in command ? command.description ?? '' : '', '');
    if ('options' in command && command.options?.length) sections.push(...renderOptions(command.options, `/${command.name}`));
    else sections.push('No options.', '');
  }
  sections.push('## Context menus', '', 'Open a message or member’s context menu, choose **Apps**, then select the action.', '');
  const descriptions: Record<string, string> = {
    'detect language': 'Detect the selected message’s language. The result is visible only to you.',
    save: 'Send yourself a DM copy of the selected message and its attachments. React with ❌ to delete the copy.',
    'user stats': 'Show the selected server member’s account, roles, presence, and other statistics privately.',
  };
  for (const command of contexts) sections.push(`### ${command.name}`, '', `Target: **${command.type === ApplicationCommandType.User ? 'server member' : 'message'}**. ${descriptions[command.name] ?? 'Select this action in Discord’s Apps menu.'}`, '');
  return `${sections.join('\n').trimEnd()}\n`;
}

if (import.meta.main) {
  const output = renderCommandReference(applicationCommandData);
  if (process.argv.includes('--check')) {
    if (await readFile('docs/commandList.md', 'utf8') !== output) throw new Error('Command reference is stale. Run npm run generate-docs.');
  } else {
    await mkdir('docs', { recursive: true });
    await writeFile('docs/commandList.md', output);
  }
}
