import { ChannelType, Collection, PermissionsBitField, type ChatInputCommandInteraction } from 'discord.js';
import type { RuntimeServices } from '../../src/contracts/features.js';

export const ids = { actor: '123456789012345678', guild: '223456789012345678', channel: '323456789012345678', message: '423456789012345678', role: '523456789012345678', other: '623456789012345678' };
export function nativeFixture(values: Record<string, unknown> = {}) {
  const replies: unknown[] = [];
  const defers: unknown[] = [];
  const dms: unknown[] = [];
  const channelSends: unknown[] = [];
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const errors: unknown[] = [];
  const avatar = () => 'https://cdn.discordapp.com/avatar.png';
  const response = { id: ids.message, url: `https://discord.com/channels/${ids.guild}/${ids.channel}/${ids.message}`,
    async edit(body: unknown) { replies.push(body); return response; }, async react(_emoji: string) {}, async pin() {},
    async awaitMessageComponent(_options: unknown): Promise<unknown> { throw new Error('Confirmation expired'); },
  };
  const user = { id: ids.actor, username: 'Requester', tag: 'Requester', bot: false, createdAt: new Date(0), createdTimestamp: 0, displayAvatarURL: avatar,
    async send(body: unknown) { dms.push(body); return response; },
  };
  const role = { id: ids.role, name: 'Members', rawPosition: 2, position: 2, color: 0, hexColor: '#000000', managed: false, hoist: false, mentionable: false, permissions: new PermissionsBitField(), createdAt: new Date(0), createdTimestamp: 0 };
  const roles = new Collection([[ids.role, role]]);
  const member = { id: ids.actor, user, displayName: 'Requester', nickname: null, joinedAt: null, joinedTimestamp: null, premiumSince: null, permissions: new PermissionsBitField(PermissionsBitField.All), roles: { cache: roles, highest: role },
    permissionsIn: (_channel: unknown) => new PermissionsBitField(PermissionsBitField.All),
  };
  const members = new Collection([[ids.actor, member]]);
  const guild = { id: ids.guild, name: 'Test Guild', description: 'Test server', memberCount: 1, premiumTier: 0, premiumSubscriptionCount: 0, preferredLocale: 'en-US', createdAt: new Date(0), createdTimestamp: 0,
    roles: { cache: roles, highest: role, async fetch() { return roles; } },
    members: { cache: members, me: { id: 'bot', permissionsIn: member.permissionsIn },
      async fetch(argument: unknown) { if (typeof argument === 'object' && argument !== null && 'time' in argument) return members; return member; },
      async fetchMe() { return this.me; },
    }, async fetchOwner() { return member; }, iconURL: () => null, bannerURL: () => null,
  };
  const source = { id: ids.other, author: user, content: 'Private source text', url: `https://discord.com/channels/${ids.guild}/${ids.channel}/${ids.other}`, attachments: new Collection(), embeds: [], createdTimestamp: Date.now(), reactions: { cache: new Collection([['thumb', { emoji: { name: '👍', id: null }, count: 4 }]]) } };
  const channel = { id: ids.channel, guildId: ids.guild, name: 'general', type: ChannelType.GuildText, guild, isTextBased: () => true, isDMBased: () => false, isThread: () => false, isSendable: () => true,
    async fetch() { return channel; },
    permissionsFor: (_subject: unknown) => new PermissionsBitField(PermissionsBitField.All),
    async send(body: unknown) { channelSends.push(body); return response; },
    messages: { async fetch(argument: unknown) { return typeof argument === 'object' ? new Collection([[source.id, source]]) : source; } },
  };
  Object.assign(source, { channel, guild });
  Object.assign(member, { guild });
  Object.assign(role, { guild });
  Object.assign(guild, { channels: { cache: new Collection([[ids.channel, channel]]), fetch: async () => channel } });
  const client = { guilds: { cache: new Collection([[ids.guild, guild]]) }, channels: { fetch: async () => channel }, users: { fetch: async () => user }, user: { id: 'bot' }, application: null };
  Object.assign(guild, { client });
  const pool = { async query(sql: string, parameters: unknown[] = []) { queries.push({ sql, values: parameters }); return { rows: [{ user_id: ids.actor }], rowCount: 1 }; } };
  const services = { client, pool, ownerIds: new Set<string>(), applicationCommands: [{ name: 'ping', description: 'Ping' }], env: {}, startedAt: 0,
    logger: { info(_message: string) {}, error(_message: string, error?: unknown) { errors.push(error); } },
  } as unknown as RuntimeServices;
  const get = (name: string) => values[name] ?? null;
  const interaction = { id: 'interaction', user, guildId: ids.guild, guild, channelId: ids.channel, channel, client,
    memberPermissions: new PermissionsBitField(PermissionsBitField.All), appPermissions: new PermissionsBitField(PermissionsBitField.All),
    options: { getString: get, getBoolean: get, getInteger: get, getUser: get, getRole: get, getChannel: get, getSubcommand: () => values.subcommand },
    async reply(body: unknown) { replies.push(body); return response; }, async editReply(body: unknown) { replies.push(body); return response; },
    async followUp(body: unknown) { replies.push(body); return response; }, async deferReply(body: unknown) { defers.push(body); }, async fetchReply() { return response; },
    webhook: { async editMessage(_id: string, body: unknown) { replies.push(body); return response; } },
  } as unknown as ChatInputCommandInteraction;
  return { interaction, values, services, user, member, guild, channel, source, response, pool, client, replies, defers, dms, channelSends, queries, errors };
}
export function output(value: unknown): string { return JSON.stringify(value); }
