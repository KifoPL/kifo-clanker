import { REST, Routes } from 'discord.js';
import { applicationCommandData } from '../src/registry.js';
import { logger } from '../src/logger.js';

const { DISCORD_TOKEN, DISCORD_APPLICATION_ID, DISCORD_TEST_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_APPLICATION_ID || !DISCORD_TEST_GUILD_ID) {
  throw new Error('DISCORD_TOKEN, DISCORD_APPLICATION_ID and DISCORD_TEST_GUILD_ID are required');
}
for (const id of [DISCORD_APPLICATION_ID, DISCORD_TEST_GUILD_ID]) {
  if (!/^\d{17,20}$/u.test(id)) throw new Error('Discord application and guild IDs must be decimal snowflakes');
}
try {
  await new REST({ version: '10', timeout: 15_000 }).setToken(DISCORD_TOKEN).put(
    Routes.applicationGuildCommands(DISCORD_APPLICATION_ID, DISCORD_TEST_GUILD_ID),
    { body: applicationCommandData },
  );
  logger.info('Migrated commands registered in the test guild');
} catch (error) {
  logger.error('Command registration failed', error);
  process.exitCode = 1;
}
