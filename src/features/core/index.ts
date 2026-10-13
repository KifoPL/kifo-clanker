import { ActivityType, EmbedBuilder } from 'discord.js';
import type { FeatureDefinition } from '../../contracts/features.js';
import { createOwnerCommands } from './owner.js';

export const coreFeature: FeatureDefinition = {
  name: 'core', commandData: [],
  create(services) {
    return {
      prefixCommands: createOwnerCommands(services),
      async onMessage(message) {
        if (message.author.bot) return 'continue';
        const prefix = (message.guildId && services.prefixes.get(message.guildId)) || '!kifo ';
        const mentioned = services.client.user && new RegExp(`^<@!?${services.client.user.id}>$`).test(message.content.trim());
        if (!mentioned && message.content.toLowerCase().trim() !== prefix.toLowerCase().trim()) return 'continue';
        const embed = new EmbedBuilder().setColor(0xa039a0).setTitle('Hello there!')
          .setDescription(`Use \`${prefix}help\` to see available commands.\nOnline for ${Math.floor((Date.now() - services.startedAt) / 60_000)} minutes.`)
          .addFields(
            { name: 'Development and support', value: '[GitHub](https://github.com/KifoPL/kifo-clanker) · [Discord](https://discord.gg/HxUFQCxPFp)' },
            { name: 'Invite and vote', value: `[Invite](https://discord.com/oauth2/authorize?client_id=${services.client.user?.id}&scope=bot%20applications.commands) · [top.gg](https://top.gg/bot/${services.client.user?.id})` },
          );
        await message.reply({ embeds: [embed] });
        return 'handled';
      },
      async onGuild(guild, event) {
        services.logger.info(`Guild lifecycle: ${event}`);
        const channelId = services.env.DISCORD_LOG_CHANNEL_ID;
        if (!channelId) return;
        const channel = await services.client.channels.fetch(channelId);
        if (channel?.isSendable()) await channel.send({ content: `Guild ${event}: ${guild.name} (${guild.id}); servers: ${services.client.guilds.cache.size}.`, allowedMentions: { parse: [] } });
      },
    };
  },
};

export function refreshPresence(client: import('discord.js').Client, startedAt: number): void {
  client.user?.setPresence({ status: 'online', activities: [{ type: ActivityType.Playing, name: `Type !kifo · online ${Math.floor((Date.now() - startedAt) / 60_000)}m` }] });
}
