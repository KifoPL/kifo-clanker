import { BOT_URLS } from '../../constants.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
export const guideChoices = [
  { name: 'Slash commands', value: 'slash' }, { name: 'Context menus', value: 'contextmenus' },
  { name: 'Epoch converter', value: 'epoch' }, { name: 'Using /ticket', value: 'ticket' },
  { name: 'Ticketing system', value: 'ticketing' }, { name: 'Auto-threading system', value: 'autothreading' },
];
export const guide: SlashCommand = {
  data: new SlashCommandBuilder().setName('guide').setDescription('Receive a guide link for a specific topic.')
    .addStringOption(option => option.setName('choice').setDescription('Select a topic to learn about.').addChoices(...guideChoices)).toJSON(),
  async execute(interaction) {
    const choice = guideChoices.find(choice => choice.value === interaction.options.getString('choice'));
    const url = choice ? BOT_URLS.guide(choice.value) : BOT_URLS.guideList;
    await interaction.reply({ content: choice ? `Learn about ${choice.name}:` : 'Read the guide list:', components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel(choice?.name ?? 'Guide List').setStyle(ButtonStyle.Link).setURL(url))], flags: MessageFlags.Ephemeral });
  },
};
