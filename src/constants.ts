export const BOT_COLOR = 0xa039a0;
export const BOT_NAME = 'Kifo Clanker';
export const BOT_REPOSITORY = 'KifoPL/kifo-clanker';
export const BOT_IDS = { production: '795638549730295820', test: '796447999747948584' } as const;
export const TEST_GUILD_ID = '822800862581751848';
export const COMMAND_REGISTRATION_CHANNEL_IDS = { production: '828100819730956348', test: '822800863050858539' } as const;

const documentation = 'https://kifopl.github.io/kifo-clanker/docs';
export const BOT_URLS = {
  repository: `https://github.com/${BOT_REPOSITORY}`,
  issues: `https://github.com/${BOT_REPOSITORY}/issues`,
  support: 'https://discord.gg/HxUFQCxPFp',
  guideList: `${documentation}/guideList`,
  guide: (topic: string): string => `${documentation}/guides/${topic}`,
  invite: (applicationId: string | undefined): string => `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=bot%20applications.commands`,
  vote: (applicationId: string | undefined): string => `https://top.gg/bot/${applicationId}`,
} as const;
