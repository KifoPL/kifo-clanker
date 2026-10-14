import { createHash } from 'node:crypto';
import { resolvePermission } from '../features/moderation/permissions.js';
import { bit, field, identifier, integer, legacyRow, text, timestamp, timezoneOffset, type LegacyRow } from './import-validation.js';

export const legacyTables = ['prefixes', 'react', 'superslow', 'superslowusers', 'ticketing', 'autothreading',
  'giveaway', 'polls', 'countdown', 'role_remove', 'perms', 'menu_perms', 'menu_roles'] as const;
export type LegacyTable = typeof legacyTables[number];
export interface ImportIssue { severity: 'error' | 'warning'; table: string; row: number; message: string }
export interface ImportRow { table: string; key: readonly string[]; values: Record<string, unknown> }
export interface ImportJob { type: string; payload: unknown; runAt: string; dedupeKey: string }
export interface ImportPlan {
  rows: ImportRow[];
  jobs: ImportJob[];
  report: { valid: boolean; sourceCounts: Record<string, number>; targetCounts: Record<string, number>; pendingJobs: number; issues: ImportIssue[] };
}

export const importTargetTables = ['guild_settings', 'auto_reactions', 'superslow_settings', 'superslow_users',
  'ticket_settings', 'autothreading_settings', 'moderation_operations', 'menus', 'polls', 'giveaways', 'countdowns'] as const;

const legacyFields: Record<LegacyTable, readonly string[]> = {
  prefixes: ['Id', 'GuildId', 'Prefix'], react: ['Id', 'ChannelId', 'emote'], superslow: ['Id', 'ChannelId', 'Time'],
  superslowusers: ['Id', 'ChannelId', 'UserId', 'Timestamp'],
  ticketing: ['Id', 'GuildId', 'ChannelId', 'ArePublic', 'DefaultSlowmode', 'DefaultArchive'],
  autothreading: ['Id', 'GuildId', 'ChannelId', 'DefaultArchive', 'DefaultSlowmode', 'BotAuto', 'Title'],
  giveaway: ['Id', 'GuildId', 'ChannelId', 'MessageId', 'UserId', 'Winners', 'EndTime', 'Reaction'],
  polls: ['Id', 'GuildId', 'ChannelId', 'MessageId', 'UserId', 'EndTime'],
  countdown: ['Id', 'GuildId', 'ChannelId', 'MessageId', 'Message', 'AuthorId', 'EndDate'],
  role_remove: ['Id', 'UserId', 'RoleId', 'PerpetratorId', 'ChannelId', 'GuildId', 'EndTime'],
  perms: ['Id', 'PerpetratorId', 'MessageId', 'ChannelId', 'GuildId', 'PermId', 'PermFlag', 'EndTime', 'Command'],
  menu_perms: ['Id', 'GuildId', 'ChannelId', 'CmdMsgId', 'CmdChId', 'MessageId', 'PermName', 'EndDate', 'StartDate', 'DestinationChannelId'],
  menu_roles: ['Id', 'GuildId', 'ChannelId', 'MessageId', 'RoleId', 'EndDate', 'StartDate', 'CmdMsgId', 'CmdChId'],
};

function stableId(table: string, key: string): string {
  const hash = createHash('sha256').update(`kifo-import:${table}:${key}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function permission(value: unknown): string {
  const input = text(value, 'Permission', 100);
  const resolved = resolvePermission(input);
  if (!resolved) throw new Error('Permission name is not recognized.');
  return resolved;
}

function duration(value: unknown, name: string, divisor: number, maximum: number): number {
  const milliseconds = integer(value ?? 0, name, 0, maximum * divisor);
  if (milliseconds % divisor !== 0) throw new Error(`${name} must be an exact multiple of ${divisor} milliseconds.`);
  return milliseconds / divisor;
}

export function prepareImport(snapshot: unknown): ImportPlan {
  const input = legacyRow(snapshot);
  const offset = timezoneOffset(input['timezone']);
  const tables = legacyRow(input['tables']);
  const plan: ImportPlan = {
    rows: [], jobs: [],
    report: { valid: true, sourceCounts: {}, targetCounts: Object.fromEntries(importTargetTables.map((table) => [table, 0])), pendingJobs: 0, issues: [] },
  };
  const issue = (severity: ImportIssue['severity'], table: string, row: number, message: string): void => {
    plan.report.issues.push({ severity, table, row, message });
    if (severity === 'error') plan.report.valid = false;
  };
  for (const table of Object.keys(tables)) {
    if (!legacyTables.includes(table as LegacyTable)) issue('error', table, 0, 'Unknown snapshot table has no migration mapping.');
  }
  const seen = new Map<string, ImportRow>();
  const uniqueSeen = new Set<string>();
  const add = (table: string, key: readonly string[], values: Record<string, unknown>, source: LegacyTable, index: number): void => {
    const identity = `${table}:${JSON.stringify(key.map((column) => values[column]))}`;
    if (seen.has(identity)) {
      issue('error', source, index, `Duplicate target key in ${table}; resolve the duplicate in the snapshot.`);
      return;
    }
    const uniqueKey = ['polls', 'giveaways', 'countdowns'].includes(table) ? `${table}:message:${values['message_id']}`
      : table === 'moderation_operations' && values['restore_at'] !== null ? JSON.stringify(['moderation', values['guild_id'], values['kind'] === 'role' ? '' : values['channel_id'], values['target_id'], values['kind'], values['permission'] ?? values['role_id']]) : undefined;
    if (uniqueKey && uniqueSeen.has(uniqueKey)) {
      issue('error', source, index, `Conflicting unique target in ${table}; resolve the duplicate in the snapshot.`);
      return;
    }
    if (uniqueKey) uniqueSeen.add(uniqueKey);
    const row = { table, key, values };
    seen.set(identity, row);
    plan.rows.push(row);
  };
  const job = (type: string, payload: unknown, runAt: string, key: string): void => {
    const prefix = ({ 'poll.complete': 'poll', 'giveaway.complete': 'giveaway', 'countdown.complete': 'countdown',
      role_restore: 'moderation', permission_restore: 'moderation' } as Record<string, string>)[type] ?? type;
    plan.jobs.push({ type, payload, runAt, dedupeKey: `${prefix}:${key}` });
  };
  const nullableDate = (value: unknown, name: string): string | null => value === null ? null : timestamp(value, name, offset);
  const nullableId = (value: unknown, name: string): string | null => value === null || value === undefined ? null : identifier(value, name);
  const reactions = new Map<string, { emojis: string[]; row: number }>();
  const cooldowns = new Map<string, { values: Record<string, unknown>; row: number }>();
  for (const table of legacyTables) {
    const sourceRows = tables[table];
    if (!Array.isArray(sourceRows)) {
      issue('error', table, 0, 'Every legacy table must be present as an array, including empty tables.');
      continue;
    }
    plan.report.sourceCounts[table] = sourceRows.length;
    sourceRows.forEach((value, index) => {
      const rowIndex = index + 1;
      try {
        const row = legacyRow(value);
        const unknownFields = Object.keys(row).filter((name) => !legacyFields[table].some((known) => known.toLowerCase() === name.toLowerCase()));
        if (unknownFields.length) throw new Error(`Unmapped source fields: ${unknownFields.join(', ')}. No data was discarded.`);
        const get = (name: string): unknown => field(row, name);
        const id = (name: string): string => identifier(get(name), name);
        const date = (name: string): string => timestamp(get(name), name, offset);
        const sourceId = get('Id') === undefined ? undefined : id('Id');
        if (table === 'prefixes') {
          add('guild_settings', ['guild_id'], { guild_id: id('GuildId'), prefix: text(get('Prefix'), 'Prefix', 100) }, table, rowIndex);
        } else if (table === 'react') {
          const channelId = id('ChannelId');
          const emoji = text(get('emote'), 'emote', 100);
          const group = reactions.get(channelId) ?? { emojis: [], row: rowIndex };
          if (group.emojis.includes(emoji)) issue('error', table, rowIndex, 'Duplicate reaction for this channel.');
          else group.emojis.push(emoji);
          if (group.emojis.length > 20) throw new Error('Channel has more than 20 automatic reactions.');
          reactions.set(channelId, group);
        } else if (table === 'superslow') {
          add('superslow_settings', ['channel_id'], { channel_id: id('ChannelId'), guild_id: null,
            duration_ms: String(integer(get('Time'), 'Time', 21_600_000, 31_557_600_000)) }, table, rowIndex);
        } else if (table === 'superslowusers') {
          const values = { channel_id: id('ChannelId'), user_id: id('UserId'), timestamp_ms: String(integer(get('Timestamp'), 'Timestamp')) };
          const key = `${values.channel_id}:${values.user_id}`;
          const previous = cooldowns.get(key);
          if (previous) {
            issue('warning', table, rowIndex, 'Repeated cooldown history collapsed to the greatest timestamp; all source rows are counted.');
            if (BigInt(previous.values['timestamp_ms'] as string) >= BigInt(values.timestamp_ms)) return;
          }
          cooldowns.set(key, { values, row: rowIndex });
        } else if (table === 'ticketing' || table === 'autothreading') {
          const rawArchive = get('DefaultArchive');
          const stringArchive = typeof rawArchive === 'string'
            ? ({ '1h': 60, '1d': 1_440, '3d': 4_320, '1w': 10_080 } as Record<string, number>)[rawArchive] : undefined;
          const archive = stringArchive ?? duration(rawArchive, 'DefaultArchive', 60_000, 10_080);
          if (![60, 1_440, 4_320, 10_080].includes(archive)) throw new Error('DefaultArchive must map to a Discord archive duration.');
          const values: Record<string, unknown> = { channel_id: id('ChannelId'), guild_id: id('GuildId'),
            slowmode_seconds: duration(get('DefaultSlowmode'), 'DefaultSlowmode', 1_000, 21_600), archive_minutes: archive };
          if (table === 'ticketing') values['are_public'] = bit(get('ArePublic'), 'ArePublic');
          else {
            values['bot_auto'] = bit(get('BotAuto'), 'BotAuto');
            values['title'] = text(get('Title'), 'Title', 6_000);
          }
          add(table === 'ticketing' ? 'ticket_settings' : 'autothreading_settings', ['channel_id'], values, table, rowIndex);
        } else if (table === 'menu_roles' || table === 'menu_perms') {
          const expiresAt = nullableDate(get('EndDate'), 'EndDate');
          const messageId = id('MessageId');
          add('menus', ['message_id'], { message_id: messageId, guild_id: id('GuildId'), channel_id: id('ChannelId'),
            command_message_id: nullableId(get('CmdMsgId'), 'CmdMsgId'), command_channel_id: nullableId(get('CmdChId'), 'CmdChId'),
            created_by: null, kind: table === 'menu_roles' ? 'role' : 'permission',
            target_id: id(table === 'menu_roles' ? 'RoleId' : 'DestinationChannelId'),
            permission: table === 'menu_roles' ? null : permission(get('PermName')), expires_at: expiresAt, created_at: date('StartDate'), closing: false }, table, rowIndex);
          if (expiresAt) job('menu.expire', { messageId }, expiresAt, messageId);
          issue('warning', table, rowIndex, 'Legacy menu lacks participant previous-state snapshots and creator ID; unknown previous states require manual reconciliation.');
        } else if (table === 'role_remove' || table === 'perms') {
          const restoreAt = nullableDate(get('EndTime'), 'EndTime');
          const legacyKey = sourceId ?? (table === 'role_remove' ? `${id('UserId')}:${id('RoleId')}:${restoreAt ?? 'permanent'}`
            : `${id('MessageId')}:${id('PermId')}:${permission(get('PermFlag'))}`);
          const operationId = stableId(table, legacyKey);
          const previous = table === 'role_remove' ? 'present' : ({ add: 'allow', deny: 'deny', rm: 'inherit' } as Record<string, string>)[text(get('Command'), 'Command', 10)];
          if (!previous) throw new Error('Command must be add, deny or rm.');
          add('moderation_operations', ['id'], { id: operationId, kind: table === 'role_remove' ? 'role' : 'permission',
            guild_id: id('GuildId'), channel_id: id('ChannelId'), target_id: id(table === 'role_remove' ? 'UserId' : 'PermId'),
            role_id: table === 'role_remove' ? id('RoleId') : null, permission: table === 'perms' ? permission(get('PermFlag')) : null,
            previous_state: previous, applied_state: table === 'role_remove' ? 'absent' : 'unknown', actor_id: id('PerpetratorId'),
            message_id: table === 'perms' ? id('MessageId') : `legacy:role_remove:${legacyKey}`, restore_at: restoreAt, status: 'applied' }, table, rowIndex);
          const type = table === 'role_remove' ? 'role_restore' : 'permission_restore';
          if (restoreAt) job(type, { operationId }, restoreAt, operationId);
          if (table === 'perms') issue('warning', table, rowIndex, 'Applied permission state is absent from legacy storage; restoration requires manual current-state validation.');
        } else {
          addScheduled(table, row, sourceId, date, nullableDate, add, job, rowIndex);
          if (table === 'polls') issue('warning', table, rowIndex, 'Question/options are absent from legacy storage and will be read from the existing Discord message.');
          if (table === 'giveaway' && get('Reaction') === null) issue('warning', table, rowIndex, 'Legacy unicode giveaway reaction is unknown; runtime reads the existing message reaction.');
        }
      } catch (error) {
        issue('error', table, rowIndex, error instanceof Error ? error.message : 'Invalid legacy row.');
      }
    });
  }
  for (const [channelId, group] of reactions) {
    add('auto_reactions', ['channel_id'], { channel_id: channelId, guild_id: null, emojis: group.emojis }, 'react', group.row);
  }
  for (const group of cooldowns.values()) {
    if (!seen.has(`superslow_settings:${JSON.stringify([group.values['channel_id']])}`)) {
      issue('error', 'superslowusers', group.row, 'Cooldown references a channel absent from superslow settings.');
    }
    add('superslow_users', ['channel_id', 'user_id'], group.values, 'superslowusers', group.row);
  }
  for (const row of plan.rows) plan.report.targetCounts[row.table] = (plan.report.targetCounts[row.table] ?? 0) + 1;
  plan.report.pendingJobs = plan.jobs.length;
  return plan;
}

function addScheduled(
  table: 'giveaway' | 'polls' | 'countdown', row: LegacyRow, sourceId: string | undefined,
  date: (name: string) => string, nullableDate: (value: unknown, name: string) => string | null,
  add: (table: string, key: readonly string[], values: Record<string, unknown>, source: LegacyTable, index: number) => void,
  job: (type: string, payload: unknown, runAt: string, key: string) => void, index: number,
): void {
  const get = (name: string): unknown => field(row, name);
  const id = (name: string): string => identifier(get(name), name);
  const recordId = stableId(table, sourceId ?? id('MessageId'));
  const values: Record<string, unknown> = { id: recordId, guild_id: id('GuildId'), channel_id: id('ChannelId'), message_id: id('MessageId'),
    user_id: id(table === 'countdown' ? 'AuthorId' : 'UserId') };
  const endAt = table === 'polls' ? nullableDate(get('EndTime'), 'EndTime') : date(table === 'countdown' ? 'EndDate' : 'EndTime');
  values['end_at'] = endAt;
  if (table === 'giveaway') {
    values['winner_count'] = integer(get('Winners'), 'Winners', 1, 2_147_483_647);
    values['reaction'] = get('Reaction') === null ? null : text(get('Reaction'), 'Reaction', 100);
    values['winner_ids'] = null;
    values['completed_at'] = null;
    add('giveaways', ['id'], values, table, index);
    job('giveaway.complete', { id: recordId }, endAt!, recordId);
  } else if (table === 'polls') {
    values['question'] = null;
    values['options'] = null;
    values['outcome'] = null;
    values['completed_at'] = null;
    add('polls', ['id'], values, table, index);
    if (endAt) job('poll.complete', { id: recordId }, endAt, recordId);
  } else {
    values['message'] = text(get('Message'), 'Message', 2_000);
    values['status'] = 'scheduled';
    values['confirmation_expires_at'] = null;
    values['outcome_message_id'] = null;
    add('countdowns', ['id'], values, table, index);
    job('countdown.complete', { id: recordId }, endAt!, recordId);
  }
}
