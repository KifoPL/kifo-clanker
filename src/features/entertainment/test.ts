import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
export const testCommand: SlashCommand = {
  data: new SlashCommandBuilder().setName('test').setDescription('Test out if slash commands work properly.')
    .addStringOption(option => option.setName('input').setDescription('The text to return.').setMaxLength(1800))
    .addStringOption(option => option.setName('input2').setDescription('The text to return.').setMaxLength(1800)).toJSON(),
  async execute(interaction) {
    const input = interaction.options.getString('input') ?? 'not passed';
    const input2 = interaction.options.getString('input2') ?? 'not passed';
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xa039a0).setTitle('Your arguments:').setDescription(`- input: \`${input}\`\n- input2: \`${input2}\``)], flags: MessageFlags.Ephemeral });
  },
};
