export const BOT_COLOR = 0xa039a0;
export const BOT_NAME = 'Kifo Clanker';
export const BOT_REPOSITORY = 'KifoPL/kifo-clanker';

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
