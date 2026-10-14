import { BOT_IDS, COMMAND_REGISTRATION_CHANNEL_ID, TEST_GUILD_ID } from '../../constants.js';
import type { RuntimeServices } from '../../contracts/features.js';

export async function registerStartupCommands(services: RuntimeServices): Promise<boolean> {
  const botId = services.client.user?.id;
  if (botId !== BOT_IDS.test && botId !== BOT_IDS.production) return false;
  const isTest = botId === BOT_IDS.test;
  const application = services.client.application;
  if (!application || !services.applicationCommands?.length) throw new Error('Application command metadata is unavailable during startup registration.');
  const guildId = isTest ? services.env.DISCORD_TEST_GUILD_ID ?? TEST_GUILD_ID : undefined;
  try {
    if (guildId) await application.commands.set([...services.applicationCommands], guildId);
    else await application.commands.set([...services.applicationCommands]);
  } catch (error) {
    services.logger.error('Startup command registration failed; check the bot application access and registration scope.', error);
    throw error;
  }
  const status = `Registered ${services.applicationCommands.length} application commands ${guildId ? `in test server ${guildId}` : 'globally'}.`;
  services.logger.info(status);
  const channelId = services.env.DISCORD_DEPLOY_CHANNEL_ID ?? COMMAND_REGISTRATION_CHANNEL_ID;
  try {
    const channel = await services.client.channels.fetch(channelId);
    if (!channel?.isSendable()) throw new Error(`Command registration channel ${channelId} is unavailable or cannot receive messages.`);
    await channel.send({ content: status, allowedMentions: { parse: [] } });
  } catch (error) {
    services.logger.error('Commands were registered, but the registration status could not be sent to Discord.', error);
  }
  return true;
}
