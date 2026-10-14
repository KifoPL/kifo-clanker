import type { CommandInvocation } from '../../src/contracts/invocation.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Collection, PermissionFlagsBits, PermissionsBitField, type GuildChannel, type GuildMember, type Role } from 'discord.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { menuCommand, menuDuration } from '../../src/features/menus/menu.js';
import { elevatedMenuPermission, elevatedMenuRole, explicitlyDenied, messageIdFromReference, safeMenuPermission, safeMenuRole } from '../../src/features/menus/safety.js';
import { isMenuEmoji, MenuService, type Menu } from '../../src/features/menus/service.js';

const menu: Menu = { message_id: '123', guild_id: 'guild', channel_id: 'channel', created_by: 'creator',
  kind: 'role', target_id: 'role', permission: null, expires_at: null, closing: false };

test('menu durations preserve permanent menus and bound expiry', () => {
  assert.equal(menuDuration(undefined), null);
  assert.equal(menuDuration('1m', 0)?.getTime(), 60_000);
  assert.throws(() => menuDuration('59s'));
  assert.throws(() => menuDuration('2y'));
  assert.throws(() => menuDuration('invalid'));
});

test('menu references accept only Discord message URLs or snowflakes', () => {
  const id = '123456789012345678';
  assert.equal(messageIdFromReference(id), id);
  assert.equal(messageIdFromReference(`https://discord.com/channels/${id}/${id}/${id}`), id);
  assert.equal(messageIdFromReference(`https://attacker.example/${id}`), undefined);
  assert.equal(messageIdFromReference(`https://discord.com/channels/@me/${id}/${id}`), undefined);
});

test('only the menu reaction, including legacy custom emojis, toggles participation', () => {
  assert.equal(isMenuEmoji('role', '🎭'), true);
  assert.equal(isMenuEmoji('role', '823658022948700240'), true);
  assert.equal(isMenuEmoji('role', '✅'), false);
  assert.equal(isMenuEmoji('permission', '857976926941478923'), true);
});

test('explicit member or role permission denies cannot be bypassed through a menu', () => {
  const overwrites = new Collection<string, { allow: PermissionsBitField; deny: PermissionsBitField }>();
  overwrites.set('role', { allow: new PermissionsBitField(), deny: new PermissionsBitField(PermissionFlagsBits.SendMessages) });
  const channel = { permissionOverwrites: { cache: overwrites } } as unknown as GuildChannel;
  const member = { id: 'user', roles: { cache: new Collection([['role', { id: 'role' }]]) } } as unknown as GuildMember;
  assert.equal(explicitlyDenied(channel, member, 'SendMessages'), true);
  overwrites.set('user', { allow: new PermissionsBitField(), deny: new PermissionsBitField(PermissionFlagsBits.SendMessages) });
  assert.equal(explicitlyDenied(channel, member, 'SendMessages'), true);
});

test('fully authorized creators can offer privileged roles and insufficient permissions are rejected', () => {
  const actor = { id: 'creator', permissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
    roles: { highest: { comparePositionTo: () => 1 } } } as unknown as GuildMember;
  const role = { id: 'role', managed: false, guild: { id: 'guild', ownerId: 'owner' },
    permissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild) } as unknown as Role;
  assert.doesNotThrow(() => safeMenuRole(actor, actor, role));
  assert.equal(elevatedMenuRole(role), true);
  const insufficient = { ...actor, permissions: new PermissionsBitField(PermissionFlagsBits.ManageRoles) } as unknown as GuildMember;
  assert.throws(() => safeMenuRole(insufficient, actor, role), /every permission/);
});

test('privileged permission menus require the actual granted bit and management permissions', () => {
  const actor = { id: 'creator' } as GuildMember;
  const bot = { id: 'bot' } as GuildMember;
  const all = new PermissionsBitField([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageMessages]);
  const channel = { permissionsFor: () => all } as unknown as GuildChannel;
  assert.doesNotThrow(() => safeMenuPermission(actor, bot, channel, 'ManageMessages'));
  assert.equal(elevatedMenuPermission('ManageMessages'), true);
  const denied = { permissionsFor: (member: GuildMember) => member.id === actor.id
    ? new PermissionsBitField([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles]) : all } as unknown as GuildChannel;
  assert.throws(() => safeMenuPermission(actor, bot, denied, 'ManageMessages'), /granted permission/);
});

test('privileged menu confirmation cannot be bypassed and cancellation causes no effects', async () => {
  const events: string[] = [];
  const replies: string[] = [];
  let approved = false;
  let revokePermissions = false;
  let changeRole = false;
  const actor = { id: 'creator', permissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
    roles: { highest: { comparePositionTo: () => 1 } } };
  const roleId = '123456789012345678';
  const role = { id: roleId, managed: false, guild: { id: 'guild', ownerId: 'owner' },
    permissions: new PermissionsBitField(PermissionFlagsBits.ManageGuild) };
  const source = { isThread: () => false, permissionsFor: () => actor.permissions };
  const message = { id: 'command', guildId: 'guild', channelId: 'channel', inGuild: () => true,
    author: { id: actor.id }, guild: { members: { fetch: async () => actor, fetchMe: async () => actor }, roles: { fetch: async () => role }, channels: { fetch: async () => source } },
    reply: async (input: string | { content?: string; components?: readonly { toJSON(): { components: readonly { custom_id?: string }[] } }[] }) => {
      replies.push(typeof input === 'string' ? input : input.content ?? '');
      const customId = typeof input === 'string' ? undefined : input.components?.[0]?.toJSON().components[0]?.custom_id;
      return { id: 'prompt', edit: async () => {}, awaitMessageComponent: async (options: {
        filter(value: { user: { id: string }; message: { id: string }; customId: string }): boolean;
      }) => {
        assert.ok(customId);
        const response = { user: { id: actor.id }, message: { id: 'prompt' }, customId: approved ? customId : `${customId}:cancel` };
        assert.equal(options.filter(response), true);
        return { ...response, update: async () => {
          if (revokePermissions) actor.permissions = new PermissionsBitField(PermissionFlagsBits.ManageRoles);
          if (changeRole) role.permissions = new PermissionsBitField(PermissionFlagsBits.Administrator);
        } };
      } };
    },
    channel: { isDMBased: () => false, isSendable: () => true, permissionsFor: () => actor.permissions, send: async () => { events.push('send'); return {
      id: 'menu', url: 'https://discord.com/channels/guild/channel/menu', react: async () => { events.push('react'); }, delete: async () => {},
    }; } },
  } as unknown as CommandInvocation;
  const services = { logger: { error() {} } } as unknown as RuntimeServices;
  const menus = { persist: async () => { events.push('persist'); }, expire: async () => {} } as unknown as MenuService;
  const command = menuCommand(services, menus);
  await command.execute(message, ['role', roleId]);
  assert.equal(events.length, 0);
  assert.match(replies[0]!, /eligible reactor.*permanently/);
  approved = true;
  await command.execute(message, ['role', roleId]);
  assert.deepEqual(events, ['send', 'persist', 'react']);
  events.length = 0;
  revokePermissions = true;
  await command.execute(message, ['role', roleId]);
  assert.equal(events.length, 0);
  assert.match(replies.at(-1)!, /permissions changed/);
  actor.permissions = new PermissionsBitField(PermissionFlagsBits.Administrator);
  revokePermissions = false;
  changeRole = true;
  await command.execute(message, ['role', roleId]);
  assert.equal(events.length, 0);
  assert.match(replies.at(-1)!, /role.*changed/);
});

test('overflow reconciliation enqueues a bounded batch and resumes its cursor', async () => {
  const jobs: string[] = [];
  const connection = { release() {}, async query(sql: string, values: unknown[] = []) {
    if (sql.includes('INSERT INTO scheduled_jobs')) { jobs.push(String(values[3])); return { rows: [{ id: String(jobs.length) }], rowCount: 1 }; }
    return { rows: [], rowCount: 0 };
  } };
  const service = new MenuService({ pool: { ...connection, connect: async () => connection } } as unknown as RuntimeServices);
  for (let index = 0; index < 105; index++) service.menus.set(String(index), { ...menu, message_id: String(index) });
  assert.equal(await service.enqueueReconciliation(), false);
  assert.equal(jobs.length, 50);
  assert.equal(await service.enqueueReconciliation(), false);
  assert.equal(jobs.length, 100);
  assert.equal(await service.enqueueReconciliation(), true);
  assert.equal(jobs.length, 105);
  assert.equal(new Set(jobs).size, 105);
});

test('SQL hydration replaces removed menus and preserves prior state if refresh fails', async () => {
  let fail = false;
  const services = { pool: { async query() {
    if (fail) throw new Error('Database unavailable');
    return { rows: [{ ...menu, message_id: 'current' }], rowCount: 1 };
  } } } as unknown as RuntimeServices;
  const service = new MenuService(services);
  service.menus.set('stale', { ...menu, message_id: 'stale' });
  await service.hydrate();
  assert.deepEqual([...service.menus.keys()], ['current']);
  fail = true;
  await assert.rejects(service.hydrate(), /Database operation failed/);
  assert.deepEqual([...service.menus.keys()], ['current']);
});

function fixture(initiallyPresent: boolean, imported = false, captureWon = true, reactorBot = false) {
  const events: string[] = [];
  const notifications: { content: string; allowedMentions: { parse: string[] } }[] = [];
  let notificationsFail = false;
  let revokePrivilege = false;
  let requireFreshSource = false;
  const sourceFetches: unknown[] = [];
  const roles = new Collection<string, { id: string }>();
  if (initiallyPresent) roles.set('role', { id: 'role' });
  const member = { id: 'user', user: { bot: reactorBot }, guild: { id: 'guild', ownerId: 'owner' }, roles: { cache: roles, highest: { id: 'member-role' },
    async add() { events.push('grant'); roles.set('role', { id: 'role' }); },
    async remove() { events.push('restore'); roles.delete('role'); },
  }, async send(input: { content: string; allowedMentions: { parse: string[] } }) {
    if (notificationsFail) throw new Error('DM unavailable');
    notifications.push(input);
  } };
  const bot = { id: 'bot', permissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
    roles: { highest: { comparePositionTo: () => 1 } } };
  const role = { id: 'role', managed: false, guild: { id: 'guild', ownerId: 'owner' }, permissions: new PermissionsBitField() };
  const guild = { members: { fetch: async (input: string | { user: string }) => (typeof input === 'string' ? input : input.user) === 'user' ? member : bot, fetchMe: async () => bot },
    roles: { fetch: async (id?: string) => {
      if (!id && revokePrivilege) bot.permissions = new PermissionsBitField(PermissionFlagsBits.ManageRoles);
      return role;
    } }, channels: { fetch: async () => ({ isTextBased: () => true,
      messages: { delete: async () => { events.push('delete menu'); }, fetch: async (options?: unknown) => {
        sourceFetches.push(options);
        if (requireFreshSource && (typeof options !== 'object' || !options || !('force' in options) || !options.force)) {
          return { reactions: { cache: new Collection() } };
        }
        return { reactions: { cache: new Collection([['role', { emoji: { id: null, name: '🎭' }, users: {
          fetch: async () => new Collection([['user', { id: 'user', bot: false }]]),
        } }]]) },
      }; } } }) } };
  let saved: { menu_id: string; user_id: string; previous_state: string; want_active: boolean; status: string } | undefined = imported
    ? { menu_id: '123', user_id: 'user', previous_state: 'unknown', want_active: false, status: 'restoring' } : undefined;
  const connection = {
    release() {},
    async query(sql: string, values: unknown[] = []) {
      if (sql.includes('INSERT INTO menu_participants')) {
        events.push('snapshot');
        saved ??= { menu_id: '123', user_id: 'user', previous_state: String(values[3]), want_active: true, status: 'capturing' };
        return { rows: [{ menu_id: '123' }], rowCount: 1 };
      }
      if (sql.includes('SELECT * FROM menu_participants')) return { rows: saved ? [saved] : [], rowCount: saved ? 1 : 0 };
      if (sql.includes('SELECT user_id FROM menu_participants')) return { rows: saved ? [{ user_id: 'user' }] : [], rowCount: saved ? 1 : 0 };
      if (sql.includes("SET previous_state=$3")) {
        if (!captureWon) { saved = undefined; return { rows: [], rowCount: 0 }; }
        if (saved) { saved.previous_state = String(values[2]); saved.status = 'granting'; }
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("SET want_active=false")) { if (saved) { saved.want_active = false; saved.status = 'restoring'; } return { rows: saved ? [{ menu_id: '123' }] : [], rowCount: saved ? 1 : 0 }; }
      if (sql.includes("SET status='active'")) { if (saved) saved.status = 'active'; return { rows: [], rowCount: 1 }; }
      if (sql.includes('DELETE FROM menu_participants')) { saved = undefined; return { rows: [], rowCount: 1 }; }
      if (sql.includes('INSERT INTO scheduled_jobs')) return { rows: [{ id: 'job' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  };
  const services = { client: { guilds: { fetch: async () => guild } },
    pool: { ...connection, connect: async () => connection }, logger: { error() {} } } as unknown as RuntimeServices;
  const service = new MenuService(services);
  service.menus.set(menu.message_id, { ...menu });
  return { service, services, events, roles, notifications, sourceFetches,
    requireFreshSource: () => { requireFreshSource = true; },
    revokePrivilege: () => { role.permissions = new PermissionsBitField(PermissionFlagsBits.ManageGuild); revokePrivilege = true; },
    failNotifications: () => { notificationsFail = true; }, getSnapshot: () => saved };
}

test('a new reaction saves its prior role state before granting and restores it on removal', async () => {
  const { service, events, roles, notifications, getSnapshot } = fixture(false);
  await service.participant('123', 'user', true);
  assert.deepEqual(events, ['snapshot', 'grant']);
  assert.equal(getSnapshot()?.previous_state, 'absent');
  await service.participant('123', 'user', false);
  assert.deepEqual(events, ['snapshot', 'grant', 'restore']);
  assert.equal(roles.has('role'), false);
  assert.equal(getSnapshot(), undefined);
  assert.deepEqual(notifications, [
    { content: 'Role menu active: <@&role>.', allowedMentions: { parse: [] } },
    { content: 'Previous role state restored for <@&role>.', allowedMentions: { parse: [] } },
  ]);
});

test('duplicate active reactions do not send another menu notification', async () => {
  const { service, notifications } = fixture(false);
  await service.participant('123', 'user', true);
  await service.participant('123', 'user', true);
  assert.equal(notifications.length, 1);
});

test('a disabled DM does not undo durable grant or restoration', async () => {
  const { service, roles, getSnapshot, failNotifications } = fixture(false);
  failNotifications();
  await service.participant('123', 'user', true);
  assert.equal(getSnapshot()?.status, 'active');
  assert.equal(roles.has('role'), true);
  await service.participant('123', 'user', false);
  assert.equal(getSnapshot(), undefined);
  assert.equal(roles.has('role'), false);
});

test('permission grants notify only after durable activation and never repeat for an active participant', async () => {
  let active = false;
  const notifications: unknown[] = [];
  const edits: unknown[] = [];
  const bot = { id: 'bot', permissions: new PermissionsBitField(PermissionFlagsBits.Administrator),
    roles: { highest: { comparePositionTo: () => 1 } } };
  const member = { id: 'user', user: { bot: false }, guild: { id: 'guild', ownerId: 'owner' },
    roles: { highest: {}, cache: new Collection() }, async send(input: unknown) { assert.equal(active, true); notifications.push(input); } };
  const channel = { isThread: () => false, permissionsFor: () => bot.permissions,
    permissionOverwrites: { cache: new Collection(), async edit(_target: unknown, changes: unknown) { edits.push(changes); } } };
  const guild = { members: { fetch: async (input: string | { user: string }) => (typeof input === 'string' ? input : input.user) === 'user' ? member : bot,
    fetchMe: async () => bot }, roles: { fetch: async () => new Collection() }, channels: { fetch: async () => channel } };
  const services = { client: { guilds: { fetch: async () => guild } }, logger: { error() {} }, pool: {
    async query(sql: string) {
      if (sql.includes('SELECT * FROM menu_participants')) return { rows: [{ menu_id: '123', user_id: 'user',
        previous_state: 'inherit', want_active: true, status: active ? 'active' : 'granting' }], rowCount: 1 };
      if (sql.includes("SET status='active'")) active = true;
      return { rows: [], rowCount: 1 };
    },
  } } as unknown as RuntimeServices;
  const service = new MenuService(services);
  service.menus.set('123', { ...menu, kind: 'permission', target_id: 'channel', permission: 'SendMessages' });
  await service.runParticipant('123', 'user', new AbortController().signal);
  await service.runParticipant('123', 'user', new AbortController().signal);
  assert.deepEqual(edits, [{ SendMessages: true }]);
  assert.deepEqual(notifications, [{ content: 'Permission menu active: `SendMessages` in <#channel>.', allowedMentions: { parse: [] } }]);
});

test('removing a menu reaction preserves a role held before the menu', async () => {
  const { service, events, roles } = fixture(true);
  await service.participant('123', 'user', true);
  await service.participant('123', 'user', false);
  assert.equal(roles.has('role'), true);
  assert.equal(events.includes('restore'), false);
});

test('imported effects with unknown snapshots remain durable for manual reconciliation', async () => {
  const { service, roles, getSnapshot } = fixture(true, true);
  await service.runParticipant('123', 'user', new AbortController().signal);
  assert.equal(roles.has('role'), true);
  assert.equal(getSnapshot()?.previous_state, 'unknown');
});

test('menu expiry reports incomplete restoration when legacy snapshots remain unresolved', async () => {
  const { service, roles, getSnapshot } = fixture(true, true);
  service.menus.set('123', { ...menu, created_by: null });
  assert.equal(await service.expire('123'), false);
  assert.equal(roles.has('role'), true);
  assert.equal(getSnapshot()?.previous_state, 'unknown');
});

test('closing a capturing participant preserves roles that the menu never granted', async () => {
  const { service, events, roles, getSnapshot } = fixture(true, true);
  Object.assign(getSnapshot()!, { previous_state: 'absent', want_active: true, status: 'capturing' });
  service.menus.set('123', { ...menu, closing: true });
  await service.runParticipant('123', 'user', new AbortController().signal);
  assert.equal(roles.has('role'), true);
  assert.equal(events.includes('restore'), false);
  assert.equal(getSnapshot(), undefined);
});

test('a concurrently cancelled capture cannot grant without a durable snapshot', async () => {
  const { service, events, roles, getSnapshot } = fixture(false, false, false);
  await service.participant('123', 'user', true);
  assert.deepEqual(events, ['snapshot']);
  assert.equal(roles.has('role'), false);
  assert.equal(getSnapshot(), undefined);
});

test('reaction admission stops at the expiry even when the scheduler has not closed the menu', async () => {
  const { service, events, roles } = fixture(false);
  service.menus.set('123', { ...menu, expires_at: new Date(0) });
  await service.participant('123', 'user', true);
  assert.deepEqual(events, []);
  assert.equal(roles.has('role'), false);
});

test('losing guild access retains participant state for restoration after the bot rejoins', async () => {
  const { service, services, getSnapshot } = fixture(true, true);
  services.client.guilds.fetch = async () => { throw Object.assign(new Error('Unknown Guild'), { code: 10004 }); };
  await assert.rejects(service.runParticipant('123', 'user', new AbortController().signal), /Unknown Guild/);
  assert.equal(getSnapshot()?.previous_state, 'unknown');
});

test('a partial reaction user cannot grant roles to a bot once its member identity is fetched', async () => {
  const { service, events, roles, getSnapshot } = fixture(false, false, true, true);
  await service.participant('123', 'user', true);
  assert.deepEqual(events, []);
  assert.equal(roles.has('role'), false);
  assert.equal(getSnapshot(), undefined);
});

test('menu expiry restores participants before deleting the message and menu record', async () => {
  const { service, events, roles } = fixture(false);
  await service.participant('123', 'user', true);
  await service.expire('123');
  assert.deepEqual(events, ['snapshot', 'grant', 'restore', 'delete menu']);
  assert.equal(roles.has('role'), false);
  assert.equal(service.menus.has('123'), false);
});

test('new menu reactions added offline capture a snapshot and grant when startup reconciles', async () => {
  const { service, events, roles, getSnapshot } = fixture(false);
  await service.ready();
  assert.deepEqual(events, ['snapshot', 'grant']);
  assert.equal(roles.has('role'), true);
  assert.equal(getSnapshot()?.previous_state, 'absent');
  assert.equal(getSnapshot()?.status, 'active');
});

test('an expired new menu never grants a reaction that was added offline', async () => {
  const { service, events, roles, getSnapshot } = fixture(false);
  service.menus.set('123', { ...menu, expires_at: new Date(0) });
  await service.ready();
  assert.deepEqual(events, []);
  assert.equal(roles.has('role'), false);
  assert.equal(getSnapshot(), undefined);
});

test('permission removal restores only its captured bit and preserves administrative changes', async () => {
  for (const current of ['allow', 'deny'] as const) {
    const edits: unknown[] = [];
    const notifications: unknown[] = [];
    const overwrite = { allow: new PermissionsBitField(current === 'allow' ? PermissionFlagsBits.SendMessages : 0n),
      deny: new PermissionsBitField(PermissionFlagsBits.AttachFiles | (current === 'deny' ? PermissionFlagsBits.SendMessages : 0n)) };
    const channel = { isThread: () => false, permissionOverwrites: {
      cache: new Collection([['user', overwrite]]),
      async edit(_user: unknown, changes: unknown) { edits.push(changes); },
    } };
    const member = { id: 'user', user: { bot: false }, send: async (input: unknown) => { notifications.push(input); } };
    const guild = { members: { fetch: async () => member, fetchMe: async () => member }, roles: { fetch: async () => new Collection() }, channels: { fetch: async () => channel } };
    const services = { client: { guilds: { fetch: async () => guild } }, logger: { error() {} }, pool: {
      async query(sql: string) {
        return { rows: sql.includes('SELECT * FROM menu_participants') ? [{ menu_id: '123', user_id: 'user',
          previous_state: 'inherit', want_active: false, status: 'restoring' }] : [], rowCount: 1 };
      },
    } } as unknown as RuntimeServices;
    const service = new MenuService(services);
    service.menus.set('123', { ...menu, kind: 'permission', target_id: 'channel', permission: 'SendMessages' });
    await service.runParticipant('123', 'user', new AbortController().signal);
    assert.deepEqual(edits, current === 'allow' ? [{ SendMessages: null }] : []);
    assert.equal(overwrite.deny.has(PermissionFlagsBits.AttachFiles), true);
    assert.deepEqual(notifications, current === 'allow'
      ? [{ content: 'Previous permission state restored for `SendMessages` in <#channel>.', allowedMentions: { parse: [] } }] : []);
  }
});

test('already-expired imported menus capture reaction provenance before scheduling cleanup', async () => {
  const events: string[] = [];
  const reactions = new Collection([['legacy', { emoji: { id: '823658022948700240', name: 'role' },
    users: { fetch: async () => new Collection([['user', { id: 'user', bot: false }]]) } }]]);
  const guild = { channels: { fetch: async () => ({ isTextBased: () => true,
    messages: { fetch: async () => ({ reactions: { cache: reactions } }) } }) } };
  const services = { client: { guilds: { fetch: async () => guild } }, logger: { error() {} },
    pool: { async query(sql: string) {
      if (sql.includes('INSERT INTO menu_participants')) events.push('capture unknown');
      if (sql.includes('INSERT INTO scheduled_jobs')) { events.push('enqueue expiry'); return { rows: [{ id: 'job' }], rowCount: 1 }; }
      return { rows: [], rowCount: 0 };
    } } } as unknown as RuntimeServices;
  const service = new MenuService(services);
  service.menus.set('123', { ...menu, created_by: null, expires_at: new Date(0) });
  await service.ready();
  assert.deepEqual(events, ['capture unknown', 'enqueue expiry']);
});

test('native menus expose typed role/permission creation and message-based restoration',async()=>{
  const {ApplicationCommandOptionType}=await import('discord.js');
  const {menuData}=await import('../../src/features/menus/menu.js');
  const {menusFeature}=await import('../../src/features/menus/index.js');
  assert.deepEqual(menuData.options?.map(option=>option.name),['help','list','role','permission','revert']);
  const role=menuData.options?.find(option=>option.name==='role');
  assert.ok(role?.type===ApplicationCommandOptionType.Subcommand);
  assert.equal(role.options?.find(option=>option.name==='role')?.type,ApplicationCommandOptionType.Role);
  const permission=menuData.options?.find(option=>option.name==='permission');
  assert.ok(permission?.type===ApplicationCommandOptionType.Subcommand);
  assert.equal(permission.options?.find(option=>option.name==='channel')?.type,ApplicationCommandOptionType.Channel);
  const runtime=menusFeature.create(new Proxy({} as RuntimeServices,{get(){throw new Error('Native construction touched services.');}}));
  assert.deepEqual(runtime.slashCommands?.map(command=>command.data.name),['menu']);
  assert.equal('prefixCommands' in runtime,false);
});


test('refreshing role definitions blocks a privileged menu grant after bot privileges are revoked', async () => {
  const { service, revokePrivilege, events, roles, getSnapshot } = fixture(false);
  revokePrivilege();
  await assert.rejects(service.participant('123', 'user', true), /every permission/);
  assert.deepEqual(events, []);
  assert.equal(roles.has('role'), false);
  assert.equal(getSnapshot(), undefined);
});

test('reconnect uses fresh message reactions before restoring saved participants', async () => {
  const { service, requireFreshSource, sourceFetches, events, roles, getSnapshot } = fixture(false);
  await service.participant('123', 'user', true);
  requireFreshSource();
  await service.ready();
  assert.deepEqual(sourceFetches, [{ message: '123', force: true }]);
  assert.deepEqual(events, ['snapshot', 'grant']);
  assert.equal(roles.has('role'), true);
  assert.equal(getSnapshot()?.status, 'active');
});


test('a departed permission-menu member keeps the overwrite snapshot while role participation can be discarded', async () => {
  for (const kind of ['permission', 'role'] as const) {
    const overwrite = { allow: new PermissionsBitField(PermissionFlagsBits.SendMessages), deny: new PermissionsBitField() };
    const channel = { isThread: () => false, permissionOverwrites: { cache: new Collection([['user', overwrite]]) } };
    let saved = true;
    const guild = { roles: { fetch: async () => new Collection() }, members: {
      fetch: async () => { throw Object.assign(new Error('Unknown Member'), { code: 10007 }); },
      fetchMe: async () => ({}),
    }, channels: { fetch: async () => channel } };
    const services = { client: { guilds: { fetch: async () => guild } }, pool: {
      async query(sql: string) {
        if (sql.includes('DELETE FROM menu_participants')) saved = false;
        return { rows: sql.includes('SELECT * FROM menu_participants') ? [{ menu_id: '123', user_id: 'user',
          previous_state: 'inherit', want_active: false, status: 'restoring' }] : [], rowCount: 1 };
      },
    } } as unknown as RuntimeServices;
    const service = new MenuService(services);
    service.menus.set('123', { ...menu, kind, permission: kind === 'permission' ? 'SendMessages' : null });
    const restoration = service.runParticipant('123', 'user', new AbortController().signal);
    if (kind === 'permission') await assert.rejects(restoration, /Unknown Member/);
    else await restoration;
    assert.equal(saved, kind === 'permission');
    assert.equal(overwrite.allow.has(PermissionFlagsBits.SendMessages), true);
  }
});
