import { EmbedBuilder } from 'discord.js';
import type { PrefixCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { color, safeMentions, utilityError } from './shared.js';
export function createPrefix(services: RuntimeServices): PrefixCommand {
  return {
    name: 'prefix', category: 'UTILITY', guildOnly: true, usage: ['prefix'], description: 'Receive details about supporting the bot and requesting a custom server prefix.',
    async execute(message) {
      try {
        const prefix = (message.guildId ? services.prefixes.get(message.guildId) : undefined) ?? services.env.DEFAULT_PREFIX ?? '!kifo ';
        await message.author.send({
          content: `__**Current prefix for ${message.guild?.name ?? 'this server'}:**__ ${JSON.stringify(prefix)}`,
          embeds: [new EmbedBuilder().setColor(color).setTitle('How to buy me a beer and receive a custom prefix')
            .setDescription('Hello! Making and hosting this bot takes time and money, so a custom server prefix is a **premium** feature. All other features remain free with the default prefix.\n\nIf you want to support this work, [buy me a beer](https://www.buymeacoffee.com/kifoPL) and **send the owner a private message** with information that identifies you, such as your Discord ID or the email used for the donation. The owner can then arrange your custom prefix.\n\nMay the force be with you!')], allowedMentions: safeMentions,
        });
      } catch (error) { await utilityError(message, error); }
    },
  };
}
