import { AttachmentBuilder, EmbedBuilder, MessageFlags, SlashCommandBuilder, type InteractionReplyOptions } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
export function testDescription(input: string | null, input2: string | null, args: string | null): string {
  if (args !== null) {
    return args.trim().split(/\s+/u).filter(Boolean).map((arg, index) => `${index + 1}. ${JSON.stringify(arg)}`).join('\n') || 'No arguments.';
  }
  return `- input: \`${input ?? 'not passed'}\`\n- input2: \`${input2 ?? 'not passed'}\``;
}
export function testReply(input: string | null, input2: string | null, args: string | null): InteractionReplyOptions {
  const description = testDescription(input, input2, args);
  return {
    embeds: [new EmbedBuilder().setColor(0xa039a0).setTitle('Your arguments:').setDescription(description.slice(0, 4096))],
    files: description.length > 4096 ? [new AttachmentBuilder(Buffer.from(description), { name: 'arguments.txt' })] : [],
    flags: MessageFlags.Ephemeral,
  };
}
export const testCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName('test').setDescription('Test out if slash commands work properly.')
    .addStringOption(option => option.setName('input').setDescription('The text to return.').setMaxLength(1800))
    .addStringOption(option => option.setName('input2').setDescription('The text to return.').setMaxLength(1800))
    .addStringOption(option => option.setName('arguments').setDescription('Show how whitespace-separated arguments are parsed.').setMaxLength(1800)).toJSON(),
  async execute(interaction) {
    await interaction.reply(testReply(interaction.options.getString('input'), interaction.options.getString('input2'), interaction.options.getString('arguments')));
  },
};
