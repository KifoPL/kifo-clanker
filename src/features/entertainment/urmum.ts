import { BOT_COLOR } from '../../constants.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
export const urmumData = new SlashCommandBuilder().setName('urmum').setDescription('Random yo momma joke.').toJSON();
export async function fetchJoke(url: string, request: typeof fetch = fetch): Promise<string> {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:') throw new Error('Joke provider must use HTTPS');
  const response = await request(endpoint, { signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!response.ok) throw new Error('Joke provider unavailable');
  const value: unknown = await response.json();
  if (typeof value !== 'object' || value === null || !('joke' in value) || typeof value.joke !== 'string' || !value.joke.trim() || value.joke.length > 3500) throw new Error('Invalid joke provider response');
  return value.joke;
}
export function createUrmum(services: RuntimeServices): SlashCommand {
  return { data: urmumData, async execute(interaction) {
    await interaction.deferReply();
    try {
      const joke = await fetchJoke(services.env.JOKE_API_URL ?? 'https://www.yomomma.info/');
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(BOT_COLOR).setTitle('Ur mum').setDescription(`${joke}\n\n*Best regards from <@${interaction.user.id}>.*`)] });
    } catch { await interaction.editReply({ content: 'The joke provider is unavailable. Please try again later.' }); }
  } };
}
