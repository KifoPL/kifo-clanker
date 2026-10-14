import type { CommandInvocation } from '../../contracts/invocation.js';
import { randomUUID } from 'node:crypto';
import { type Guild, type GuildChannel, type GuildMember, type Role } from 'discord.js';
import type { PoolClient } from 'pg';
import type { RuntimeServices } from '../../contracts/features.js';
import { enqueueJob, query, withTransaction } from '../../db/index.js';
import { permissionState, permissionValue, resolvePermission, type PermissionState } from '../moderation/permissions.js';
import { authorizeTarget } from '../moderation/authorization.js';
import { explicitlyDenied, safeMenuPermission, safeMenuRole } from './safety.js';

export interface Menu {
  message_id: string;
  guild_id: string;
  channel_id: string;
  created_by: string | null;
  kind: 'role' | 'permission';
  target_id: string;
  permission: string | null;
  expires_at: Date | null;
  closing: boolean;
}

interface Participant {
  menu_id: string;
  user_id: string;
  previous_state: PermissionState | 'present' | 'absent' | 'unknown';
  want_active: boolean;
  status: 'capturing' | 'granting' | 'active' | 'restoring';
}

// Unknown Guild can mean the bot was removed; keep snapshots until access returns.
const missing = (error: unknown): boolean => !!error && typeof error === 'object' && 'code' in error
  && [10003, 10007, 10008, 10011, 10013].includes(Number(error.code));

const closing = (menu: Menu): boolean => menu.closing || !!(menu.expires_at && menu.expires_at.getTime() <= Date.now());

export const menuEmoji = (kind: Menu['kind']): string => kind === 'role' ? '🎭' : '✅';
export const isMenuEmoji = (kind: Menu['kind'], emoji: string | null): boolean => emoji === menuEmoji(kind)
  || emoji === (kind === 'role' ? '823658022948700240' : '857976926941478923');

export class MenuService {
  readonly menus = new Map<string, Menu>();
  private readonly work = new Map<string, Promise<void>>();
  private reconciliation: { ids: string[]; generation: string } | undefined;

  constructor(private readonly services: RuntimeServices) {}

  async hydrate(): Promise<void> {
    const result = await query<Menu>(this.services.pool, 'SELECT * FROM menus');
    this.menus.clear();
    for (const menu of result.rows) this.menus.set(menu.message_id, menu);
    this.reconciliation = undefined;
  }

  async enqueueReconciliation(): Promise<boolean> {
    this.reconciliation ??= { ids: [...this.menus.keys()], generation: randomUUID() };
    const pending = this.reconciliation;
    const batch = pending.ids.slice(0, 50);
    await withTransaction(this.services.pool, async client => {
      for (const messageId of batch) await enqueueJob(client, 'menu.reconcile', { messageId }, new Date(0),
        `menu.reconcile:${pending.generation}:${messageId}`);
    });
    pending.ids.splice(0, batch.length);
    if (pending.ids.length > 0) return false;
    this.reconciliation = undefined;
    return true;
  }

  private serial(key: string, callback: () => Promise<void>): Promise<void> {
    const previous = this.work.get(key) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(callback);
    this.work.set(key, next);
    void next.finally(() => { if (this.work.get(key) === next) this.work.delete(key); }).catch(() => {});
    return next;
  }

  private async notify(member: GuildMember, content: string): Promise<void> {
    if (member.user.bot) return;
    try { await member.send({ content, allowedMentions: { parse: [] } }); }
    catch (error) { this.services.logger.error('Menu notification failed', error); }
  }

  async persist(menu: Menu, command: Pick<CommandInvocation, 'id' | 'channelId'>): Promise<void> {
    await withTransaction(this.services.pool, async (client) => {
      await query(client, `INSERT INTO menus
        (message_id,guild_id,channel_id,command_message_id,command_channel_id,created_by,kind,target_id,permission,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [menu.message_id, menu.guild_id, menu.channel_id,
        command.id, command.channelId, menu.created_by, menu.kind, menu.target_id, menu.permission, menu.expires_at]);
      if (menu.expires_at) await enqueueJob(client, 'menu.expire', { messageId: menu.message_id }, menu.expires_at, `menu.expire:${menu.message_id}`);
    });
    this.menus.set(menu.message_id, menu);
  }

  private async targets(menu: Menu, userId: string): Promise<{
    guild: Guild; member: GuildMember; bot: GuildMember; role?: Role; channel?: GuildChannel;
  } | undefined> {
    try {
      const guild = await this.services.client.guilds.fetch(menu.guild_id);
      await guild.roles.fetch();
      const [member, bot] = await Promise.all([guild.members.fetch({ user: userId, force: true }), guild.members.fetchMe({ force: true })]);
      if (menu.kind === 'role') {
        const role = await guild.roles.fetch(menu.target_id, { force: true });
        return role ? { guild, member, bot, role } : undefined;
      }
      const channel = await guild.channels.fetch(menu.target_id, { force: true });
      return channel && !channel.isThread() ? { guild, member, bot, channel } : undefined;
    } catch (error) {
      // Member overwrites survive departures; retain their snapshots for safe restoration after rejoining.
      if (menu.kind === 'permission' && error && typeof error === 'object' && 'code' in error && Number(error.code) === 10007) throw error;
      if (missing(error)) return undefined;
      throw error;
    }
  }

  private async reconcileParticipant(menu: Menu, userId: string, signal?: AbortSignal): Promise<void> {
    const result = await query<Participant>(this.services.pool,
      'SELECT * FROM menu_participants WHERE menu_id=$1 AND user_id=$2', [menu.message_id, userId]);
    const participant = result.rows[0];
    if (!participant) return;
    signal?.throwIfAborted();
    const target = await this.targets(menu, userId);
    if (!target) {
      await query(this.services.pool, 'DELETE FROM menu_participants WHERE menu_id=$1 AND user_id=$2', [menu.message_id, userId]);
      return;
    }
    const { member, bot, role, channel } = target;
    signal?.throwIfAborted();
    if (participant.status === 'capturing' && (!participant.want_active || closing(menu))) {
      await query(this.services.pool, `DELETE FROM menu_participants
        WHERE menu_id=$1 AND user_id=$2 AND status='capturing' AND want_active=$3`, [menu.message_id, userId, participant.want_active]);
      return;
    }
    if (participant.want_active && !closing(menu)) {
      if (participant.status === 'active') return;
      const actor = menu.created_by ? await target.guild.members.fetch({ user: menu.created_by, force: true }) : bot;
      authorizeTarget(actor, bot, member);
      if (participant.status === 'capturing') {
        // Admission now owns the target; fetch the snapshot after earlier moderation effects have settled.
        const permission = resolvePermission(menu.permission ?? '');
        participant.previous_state = role ? (member.roles.cache.has(role.id) ? 'present' : 'absent')
          : channel && permission ? permissionState(channel, userId, permission) : 'unknown';
        const captured = await query(this.services.pool, `UPDATE menu_participants SET previous_state=$3,status='granting'
          WHERE menu_id=$1 AND user_id=$2 AND status='capturing' AND want_active
            AND EXISTS (SELECT 1 FROM menus WHERE message_id=$1 AND NOT closing
              AND (expires_at IS NULL OR expires_at>clock_timestamp())) RETURNING user_id`,
          [menu.message_id, userId, participant.previous_state]);
        if (!captured.rowCount) return;
      }
      signal?.throwIfAborted();
      if (closing(menu)) return;
      if (role) {
        safeMenuRole(actor, bot, role);
        await member.roles.add(role, 'Reaction menu');
      } else if (channel) {
        const permission = resolvePermission(menu.permission ?? '');
        if (!permission) throw new Error('Unknown menu permission');
        safeMenuPermission(actor, bot, channel, permission);
        if (explicitlyDenied(channel, member, permission)) throw new Error('An explicit deny blocks this menu');
        await channel.permissionOverwrites.edit(member, { [permission]: true }, { reason: 'Reaction menu' });
      }
      const activated = await query(this.services.pool, `UPDATE menu_participants SET status='active'
        WHERE menu_id=$1 AND user_id=$2 AND want_active AND status='granting'
          AND EXISTS (SELECT 1 FROM menus WHERE message_id=$1 AND NOT closing
            AND (expires_at IS NULL OR expires_at>clock_timestamp())) RETURNING user_id`, [menu.message_id, userId]);
      if (activated.rowCount && participant.previous_state !== 'unknown') {
        await this.notify(member, role ? `Role menu active: <@&${role.id}>.`
          : `Permission menu active: \`${menu.permission}\` in <#${menu.target_id}>.`);
      }
      return;
    }
    let restored = true;
    // Existing imported effects have no trustworthy prior snapshot; never remove an unrelated role/overwrite.
    if (participant.previous_state === 'unknown') {
      this.services.logger.error('Imported menu effect has no prior snapshot; manual reconciliation required');
      return;
    } else if (role) {
      if (participant.previous_state === 'absent' && member.roles.cache.has(role.id)) await member.roles.remove(role, 'Reaction menu reverted');
      else restored = member.roles.cache.has(role.id) === (participant.previous_state === 'present');
    } else if (channel) {
      const permission = resolvePermission(menu.permission ?? '');
      if (!permission) throw new Error('Unknown menu permission');
      const current = permissionState(channel, userId, permission);
      if (current === 'allow' && ['allow', 'deny', 'inherit'].includes(participant.previous_state)) {
        await channel.permissionOverwrites.edit(member,
          { [permission]: permissionValue(participant.previous_state as PermissionState) }, { reason: 'Reaction menu reverted' });
      } else if (current !== participant.previous_state) {
        restored = false;
        this.services.logger.error('Menu permission changed by another actor; preserving the current overwrite');
      }
    }
    const deleted = await query(this.services.pool, `DELETE FROM menu_participants
      WHERE menu_id=$1 AND user_id=$2 AND previous_state=$3 AND status=$4
        AND (NOT want_active OR EXISTS (SELECT 1 FROM menus WHERE message_id=$1
          AND (closing OR expires_at<=clock_timestamp()))) RETURNING user_id`,
    [menu.message_id, userId, participant.previous_state, participant.status]);
    if (deleted.rowCount && restored) await this.notify(member, role ? `Previous role state restored for <@&${role.id}>.`
      : `Previous permission state restored for \`${menu.permission}\` in <#${menu.target_id}>.`);
  }

  async participant(messageId: string, userId: string, added: boolean, signal?: AbortSignal): Promise<void> {
    const menu = this.menus.get(messageId);
    if (!menu || (added && closing(menu))) return;
    await this.serial(`${messageId}:${userId}`, async () => {
      if (added) {
        const target = await this.targets(menu, userId);
        if (!target || target.member.user.bot || closing(menu)) return;
        const actor = menu.created_by ? await target.guild.members.fetch({ user: menu.created_by, force: true }) : target.bot;
        authorizeTarget(actor, target.bot, target.member);
        let previous: Participant['previous_state'];
        if (target.role) {
          safeMenuRole(actor, target.bot, target.role);
          previous = target.member.roles.cache.has(target.role.id) ? 'present' : 'absent';
        } else {
          const permission = resolvePermission(menu.permission ?? '');
          if (!permission || !target.channel) return;
          safeMenuPermission(actor, target.bot, target.channel, permission);
          if (explicitlyDenied(target.channel, target.member, permission)) return;
          previous = permissionState(target.channel, userId, permission);
        }
        await withTransaction(this.services.pool, async (client) => {
          const targetKey = `${menu.guild_id}:${userId}:${menu.kind}:${menu.target_id}:${menu.permission ?? ''}`;
          await query(client, 'SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [targetKey]);
          const overlap = await query(client, `SELECT id FROM moderation_operations WHERE guild_id=$1 AND target_id=$2
            AND kind=$3 AND (status='intent' OR (status='applied' AND restore_at IS NOT NULL))
            AND (($3='role' AND role_id=$4) OR ($3='permission' AND channel_id=$4 AND permission=$5))`,
          [menu.guild_id, userId, menu.kind, menu.target_id, menu.permission]);
          if (overlap.rowCount) throw new Error('A temporary moderation change already owns this role or permission');
          const saved = await query(client, `INSERT INTO menu_participants(menu_id,user_id,target_key,previous_state)
            SELECT $1,$2,$3,$4 WHERE EXISTS (SELECT 1 FROM menus WHERE message_id=$1 AND NOT closing
              AND (expires_at IS NULL OR expires_at>clock_timestamp()))
            ON CONFLICT (menu_id,user_id) DO UPDATE SET want_active=true,
              status=CASE WHEN menu_participants.want_active AND menu_participants.status='active' THEN 'active'
                WHEN menu_participants.status='capturing' THEN 'capturing' ELSE 'granting' END RETURNING menu_id`,
          [messageId, userId, targetKey, previous]);
          if (saved.rowCount) await this.enqueueParticipant(client, messageId, userId);
        });
      } else {
        await withTransaction(this.services.pool, async (client) => {
          const result = await query(client, "UPDATE menu_participants SET want_active=false,status=CASE WHEN status='capturing' THEN 'capturing' ELSE 'restoring' END WHERE menu_id=$1 AND user_id=$2 RETURNING menu_id", [messageId, userId]);
          if (result.rowCount) await this.enqueueParticipant(client, messageId, userId);
        });
      }
      await this.reconcileParticipant(menu, userId, signal);
    });
  }

  private async enqueueParticipant(client: PoolClient, messageId: string, userId: string): Promise<void> {
    await enqueueJob(client, 'menu.participant', { messageId, userId }, new Date(), `menu.participant:${randomUUID()}`);
  }

  async runParticipant(messageId: string, userId: string, signal: AbortSignal): Promise<void> {
    const menu = this.menus.get(messageId);
    if (menu) await this.serial(`${messageId}:${userId}`, () => this.reconcileParticipant(menu, userId, signal));
  }

  async expire(messageId: string, signal?: AbortSignal): Promise<boolean> {
    let restored = true;
    await this.serial(`expire:${messageId}`, async () => { restored = await this.closeMenu(messageId, signal); });
    return restored;
  }

  private async closeMenu(messageId: string, signal?: AbortSignal): Promise<boolean> {
    const menu = this.menus.get(messageId);
    if (!menu) return true;
    menu.closing = true;
    await withTransaction(this.services.pool, async client => {
      await query(client, 'UPDATE menus SET closing=true WHERE message_id=$1', [messageId]);
      await enqueueJob(client, 'menu.expire', { messageId }, new Date(0), `menu.close:${messageId}`);
    });
    const participants = await query<{ user_id: string }>(this.services.pool,
      'SELECT user_id FROM menu_participants WHERE menu_id=$1', [messageId]);
    for (const { user_id: userId } of participants.rows) {
      signal?.throwIfAborted();
      await this.serial(`${messageId}:${userId}`, async () => {
        await query(this.services.pool, "UPDATE menu_participants SET want_active=false,status=CASE WHEN status='capturing' THEN 'capturing' ELSE 'restoring' END WHERE menu_id=$1 AND user_id=$2", [messageId, userId]);
        await this.reconcileParticipant(menu, userId, signal);
      });
    }
    signal?.throwIfAborted();
    try {
      const guild = await this.services.client.guilds.fetch(menu.guild_id);
      const channel = await guild.channels.fetch(menu.channel_id);
      if (channel?.isTextBased()) await channel.messages.delete(messageId);
    } catch (error) { if (!missing(error)) throw error; }
    const unresolved = await query(this.services.pool, 'SELECT user_id FROM menu_participants WHERE menu_id=$1 LIMIT 1', [messageId]);
    if (unresolved.rowCount || menu.created_by === null) {
      if (menu.created_by === null) this.services.logger.error('Imported menu provenance retained; missing prior snapshots need manual reconciliation');
      this.menus.delete(messageId);
      return false;
    }
    await query(this.services.pool, 'DELETE FROM menus WHERE message_id=$1', [messageId]);
    this.menus.delete(messageId);
    return true;
  }

  async ready(messageId?: string, signal?: AbortSignal): Promise<void> {
    const selected = messageId ? [...this.menus.values()].filter(menu => menu.message_id === messageId) : this.menus.values();
    for (const menu of selected) {
      signal?.throwIfAborted();
      try {
        const guild = await this.services.client.guilds.fetch(menu.guild_id);
        const channel = await guild.channels.fetch(menu.channel_id);
        if (!channel?.isTextBased()) { await this.expire(menu.message_id); continue; }
        const message = await channel.messages.fetch({ message: menu.message_id, force: true });
        const reaction = message.reactions.cache.find(item => isMenuEmoji(menu.kind, item.emoji.id ?? item.emoji.name));
        const reacted = new Set<string>();
        if (reaction) {
          let after: string | undefined;
          while (true) {
            signal?.throwIfAborted();
            const users = await reaction.users.fetch({ limit: 100, ...(after ? { after } : {}) });
            for (const user of users.values()) if (!user.bot) reacted.add(user.id);
            if (users.size < 100) break;
            after = users.lastKey();
          }
        }
        const saved = await query<Participant>(this.services.pool, 'SELECT * FROM menu_participants WHERE menu_id=$1', [menu.message_id]);
        const known = new Map(saved.rows.map(participant => [participant.user_id, participant]));
        const closing = menu.closing || !!(menu.expires_at && menu.expires_at.getTime() <= Date.now());
        for (const userId of reacted) {
          signal?.throwIfAborted();
          if (menu.created_by === null) {
            await query(this.services.pool, `INSERT INTO menu_participants(menu_id,user_id,target_key,previous_state,status)
              VALUES ($1,$2,$3,'unknown','active') ON CONFLICT DO NOTHING`,
            [menu.message_id, userId, `${menu.guild_id}:${userId}:${menu.kind}:${menu.target_id}:${menu.permission ?? ''}`]);
          } else if (!closing && (!known.has(userId) || !known.get(userId)!.want_active)) {
            // New menus always persist intent first: no participant means an offline reaction had no effect yet.
            await this.participant(menu.message_id, userId, true, signal);
          }
        }
        // Imported overdue menus still need their reaction users recorded before their message disappears.
        if (closing) {
          await enqueueJob(this.services.pool, 'menu.expire', { messageId: menu.message_id },
            menu.expires_at ?? new Date(0), `menu.expire:${menu.message_id}`);
          continue;
        }
        for (const participant of saved.rows) {
          signal?.throwIfAborted();
          if (!reacted.has(participant.user_id)) await this.participant(menu.message_id, participant.user_id, false, signal);
          else if (participant.status !== 'active') await this.runParticipant(menu.message_id, participant.user_id, signal ?? new AbortController().signal);
        }
      } catch (error) {
        if (missing(error)) await this.expire(menu.message_id);
        else if (messageId) throw error;
        else {
          this.services.logger.error('Menu hydration failed; retained for retry', error);
          await enqueueJob(this.services.pool, 'menu.reconcile', { messageId: menu.message_id },
            new Date(0), `menu.reconcile:${menu.message_id}:${this.services.startedAt}`);
        }
      }
    }
  }
}
