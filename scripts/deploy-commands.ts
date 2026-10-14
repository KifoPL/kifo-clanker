import { readDeployConfig } from '../src/config.js';
import { REST, Routes } from 'discord.js';
import { applicationCommandData } from '../src/registry.js';
import { logger } from '../src/logger.js';

try {
  const { discordToken, applicationId, testGuildId } = readDeployConfig(process.env);
  await new REST({ version: '10', timeout: 15_000 }).setToken(discordToken).put(
    Routes.applicationGuildCommands(applicationId, testGuildId),
    { body: applicationCommandData },
  );
  logger.info('Migrated commands registered in the test guild');
} catch (error) {
  logger.error('Command registration failed', error);
  process.exitCode = 1;
}
