import { BOT_COLOR } from '../../constants.js';
import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import type { InvocationCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { assertCanRead, fetchVisibleMessage, safeMentions, utilityError } from './shared.js';

export const langData = new SlashCommandBuilder().setName('lang').setDescription('Detect a message’s language.').setContexts(InteractionContextType.Guild)
  .addStringOption(option => option.setName('message').setDescription('Discord message ID or link.').setRequired(true).setMaxLength(300)).toJSON();

export interface Detection { language: string; confidence: number; isReliable: boolean }
export function readDetections(body: unknown): Detection[] {
  if (typeof body !== 'object' || body === null || !('data' in body) || typeof body.data !== 'object' || body.data === null || !('detections' in body.data) || !Array.isArray(body.data.detections)) throw new Error('The language provider returned an invalid response.');
  return body.data.detections.map((row: unknown) => {
    if (typeof row !== 'object' || row === null || !('language' in row) || typeof row.language !== 'string' || !('confidence' in row) || typeof row.confidence !== 'number' || !Number.isFinite(row.confidence) || !('isReliable' in row) || typeof row.isReliable !== 'boolean') throw new Error('The language provider returned invalid detection data.');
    return { language: row.language, confidence: row.confidence, isReliable: row.isReliable };
  });
}

export function languageName(code: string): string {
  try {
    const english = new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
    const native = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
    return native !== english ? `${english} (${native})` : english;
  } catch { return code; }
}

export async function detectLanguage(text: string, key: string | undefined): Promise<EmbedBuilder> {
  if (!key) throw new Error('Language detection is not configured. The owner must set LANGUAGE_DETECT_KEY.');
  if (!text.trim()) throw new Error('This message has no text to detect.');
  const response = await fetch('https://ws.detectlanguage.com/0.2/detect', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text }), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Language detection failed (${response.status}). Please try again later.`);
  const detections = readDetections(await response.json());
  if (!detections.length) throw new Error('Could not detect a language.');
  return new EmbedBuilder().setColor(BOT_COLOR).setTitle('Detected language:')
    .addFields(detections.slice(0, 25).map(row => ({ name: languageName(row.language).slice(0, 256), value: `Confidence: ${row.confidence}\n${row.isReliable ? '✅ Pretty sure!' : '❌ Not so certain.'}` })))
    .setFooter({ text: 'Language names and native names use Unicode CLDR metadata. Detection powered by Detect Language.' });
}

export function createLang(services: RuntimeServices): InvocationCommand {
  return {
    name: 'lang', category: 'UTILITY', guildOnly: true, usage: ['/lang message:<message ID or Discord link>'], description: 'Detect the language of a message using Detect Language.',
    async execute(invocation, args) {
      try {
        if (args.length !== 1) throw new Error('Usage: /lang message:<message ID or Discord link>');
        const target = await fetchVisibleMessage(services.client, invocation.author.id, invocation.channel, args[0]!);
        const embed = await detectLanguage(target.content, services.env.LANGUAGE_DETECT_KEY);
        await assertCanRead(target.channel, invocation.author.id);
        await invocation.reply({ embeds: [embed], allowedMentions: safeMentions });
      } catch (error) { await utilityError(invocation, error); }
    },
  };
}
