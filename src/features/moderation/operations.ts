import { randomUUID } from 'node:crypto';
import { PermissionFlagsBits, type Guild, type GuildChannel } from 'discord.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { query, withTransaction, enqueueJob } from '../../db/index.js';
import type { ScheduledHandler } from '../../scheduler/index.js';
import { permissionState, permissionValue, resolvePermission, type PermissionName, type PermissionState } from './permissions.js';
import { authorizeChannel, authorizePermissionGrant, authorizeRole, authorizeTarget } from './authorization.js';

type State = PermissionState | 'present' | 'absent' | 'unknown';
export interface OperationRow {
  id: string; kind: 'permission' | 'role'; guild_id: string; channel_id: string;
  target_id: string; role_id: string | null; permission: string | null;
  previous_state: State; applied_state: State; actor_id: string; message_id: string;
  restore_at: Date | null; status: 'intent' | 'applied' | 'restored' | 'conflict' | 'failed';
}
interface Mutation {
  guild: Guild; channel: Pick<GuildChannel, 'id'>; targetId: string; actorId: string; messageId: string; restoreAt?: Date;
}
const activeEffects = new WeakMap<RuntimeServices, Map<string, Promise<void>>>();
export function restorationDecision(previous: State, applied: State, current: State, status: string): 'restore' | 'done' | 'conflict' {
  if (status === 'restored' || status === 'failed' || status === 'conflict') return 'done';
  if (current === previous) return 'done';
  if (applied === 'unknown' || current !== applied) return 'conflict';
  return 'restore';
}
async function persistIntent(services: RuntimeServices, mutation: Mutation, kind: 'permission' | 'role', previous: State, applied: State, permission: string | null, roleId: string | null): Promise<string> {
  const id = randomUUID();
  await withTransaction(services.pool, async connection => {
    // Serialize admission for the same target before committing, never hold a transaction across Discord calls.
    await query(connection, 'SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${mutation.guild.id}:${mutation.targetId}:${kind}:${kind === 'role' ? roleId : mutation.channel.id}:${permission ?? ''}`]);
    const existing = await query(connection, `SELECT id FROM moderation_operations WHERE guild_id=$1 AND ($4='role' OR channel_id=$2) AND target_id=$3 AND kind=$4 AND COALESCE(permission,role_id)=$5 AND (status='intent' OR (status='applied' AND restore_at IS NOT NULL))`, [mutation.guild.id,mutation.channel.id,mutation.targetId,kind,permission ?? roleId]);
    if (existing.rowCount) throw new Error('A temporary operation is already active for this target. Wait for its restoration.');
    const menu = await query(connection, `SELECT p.menu_id FROM menu_participants p JOIN menus m ON m.message_id=p.menu_id WHERE m.guild_id=$1 AND p.user_id=$2 AND m.kind=$3 AND m.target_id=$4 AND ($3='role' OR m.permission=$5) LIMIT 1`,[mutation.guild.id,mutation.targetId,kind,kind === 'role' ? roleId : mutation.channel.id,permission]);
    if (menu.rowCount) throw new Error('A reaction menu owns this member role or permission. Leave the menu before changing it.');
    await query(connection, `INSERT INTO moderation_operations (id,kind,guild_id,channel_id,target_id,role_id,permission,previous_state,applied_state,actor_id,message_id,restore_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [id,kind,mutation.guild.id,mutation.channel.id,mutation.targetId,roleId,permission,previous,applied,mutation.actorId,mutation.messageId,mutation.restoreAt ?? null]);
    if (mutation.restoreAt) await enqueueJob(connection, kind === 'role' ? 'role_restore' : 'permission_restore', { operationId: id }, mutation.restoreAt, `moderation:${id}`);
  });
  return id;
}
async function apply(services: RuntimeServices, id: string, action: () => Promise<unknown>): Promise<void> {
  let effects = activeEffects.get(services);
  if (!effects) { effects = new Map(); activeEffects.set(services,effects); }
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  // Register synchronously before admission I/O. A due restorer must wait for this
  // attempt to settle before deciding that an unchanged prior state is already done.
  effects.set(id,pending);
  try {
    await prepare(services,id,async () => {
      const admitted = await query(services.pool, `SELECT id FROM moderation_operations WHERE id=$1 AND status='intent' AND (restore_at IS NULL OR restore_at > CURRENT_TIMESTAMP)`, [id]);
      if (!admitted.rowCount) throw new Error('The moderation intent expired or was reconciled before it could be applied.');
    });
    try { await action(); }
    catch (error) {
      // A network failure may follow a successful Discord effect. Keep temporary intent for reconciliation.
      await query(services.pool, `UPDATE moderation_operations SET status=CASE WHEN restore_at IS NULL THEN 'failed' ELSE 'intent' END WHERE id=$1 AND status='intent'`, [id]);
      throw error;
    }
    await query(services.pool, `UPDATE moderation_operations SET status='applied' WHERE id=$1 AND status='intent'`, [id]);
  } finally {
    effects.delete(id);
    finish();
  }
}
async function finalizeSnapshot(services: RuntimeServices, id: string, previous: State, applied: State): Promise<void> {
  const result = await query(services.pool, `UPDATE moderation_operations SET previous_state=$2,applied_state=$3 WHERE id=$1 AND status='intent' AND (restore_at IS NULL OR restore_at > CURRENT_TIMESTAMP) RETURNING id`, [id,previous,applied]);
  if (!result.rowCount) throw new Error('The moderation intent expired or was reconciled before it could be applied.');
}
async function prepare<T>(services: RuntimeServices, id: string, inspect: () => Promise<T>): Promise<T> {
  try { return await inspect(); }
  catch (error) {
    // No Discord effect has been attempted. Release admission for caught preparation failures;
    // process interruption still leaves the unknown snapshot for conservative recovery.
    await query(services.pool, `UPDATE moderation_operations SET status='failed' WHERE id=$1 AND status='intent'`, [id]);
    throw error;
  }
}
export async function setTemporaryPermission(services: RuntimeServices, mutation: Mutation & {channel: GuildChannel; permission: PermissionName; state: PermissionState}): Promise<void> {
  const initial = await mutation.channel.fetch(true);
  // Reserve ownership before taking the authoritative snapshot. An unfinished capture is unknown,
  // so recovery never mistakes another operation's completed effect for our own.
  const id = await persistIntent(services,mutation,'permission',permissionState(initial,mutation.targetId,mutation.permission),'unknown',mutation.permission,null);
  const freshChannel = await prepare(services,id,async () => {
    const channel = await mutation.channel.fetch(true);
    const previous = permissionState(channel,mutation.targetId,mutation.permission);
    await finalizeSnapshot(services,id,previous,mutation.state);
    await mutation.guild.roles.fetch();
    const [actor,bot,targetRole] = await Promise.all([mutation.guild.members.fetch({user:mutation.actorId,force:true}),mutation.guild.members.fetchMe({force:true}),mutation.guild.roles.fetch(mutation.targetId)]);
    const target = targetRole ?? await mutation.guild.members.fetch({user:mutation.targetId,force:true});
    const fresh = await channel.fetch(true);
    authorizeChannel(actor,bot,fresh);
    authorizeTarget(actor,bot,target);
    if (mutation.state === 'allow') authorizePermissionGrant(actor,bot,fresh,PermissionFlagsBits[mutation.permission]);
    if (permissionState(fresh,mutation.targetId,mutation.permission) !== previous) throw new Error('The permission changed while preparing the operation. Please retry.');
    return fresh;
  });
  await apply(services,id, () => freshChannel.permissionOverwrites.edit(mutation.targetId, {[mutation.permission]: permissionValue(mutation.state)}, {reason:`perms by ${mutation.actorId}; operation ${id}`}));
}
export async function removeRole(services: RuntimeServices, mutation: Mutation & {roleId: string}): Promise<void> {
  const member = await mutation.guild.members.fetch({user:mutation.targetId,force:true});
  if (!member.roles.cache.has(mutation.roleId)) throw new Error('The member does not have this role.');
  const id = await persistIntent(services,mutation,'role','present','unknown',null,mutation.roleId);
  const currentMember = await prepare(services,id,async () => {
    const freshMember = await mutation.guild.members.fetch({user:mutation.targetId,force:true});
    if (!freshMember.roles.cache.has(mutation.roleId)) throw new Error('The member no longer has this role.');
    await finalizeSnapshot(services,id,'present','absent');
    await mutation.guild.roles.fetch();
    const [actor,bot,role,current] = await Promise.all([mutation.guild.members.fetch({user:mutation.actorId,force:true}),mutation.guild.members.fetchMe({force:true}),mutation.guild.roles.fetch(mutation.roleId),mutation.guild.members.fetch({user:mutation.targetId,force:true})]);
    if (!role) throw new Error('The role was deleted.');
    authorizeRole(actor,bot,role);
    authorizeTarget(actor,bot,current);
    if (!current.roles.cache.has(mutation.roleId)) throw new Error('The member no longer has this role.');
    return current;
  });
  await apply(services,id, () => currentMember.roles.remove(mutation.roleId,`remove by ${mutation.actorId}; operation ${id}`));
}
async function restorationNotice(services: RuntimeServices, operation: OperationRow, conflict: boolean, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  const content = conflict
    ? `Temporary ${operation.kind} operation ${operation.id} needs review: its state changed or its snapshot is incomplete. Guild ${operation.guild_id}; target ${operation.target_id}; ${operation.permission ?? operation.role_id}.`
    : `Temporary ${operation.kind} operation ${operation.id} finished with its prior state restored. Guild ${operation.guild_id}; target ${operation.target_id}; ${operation.permission ?? operation.role_id}.`;
  const payload = {content,allowedMentions:{parse:[] as []}};
  try {
    const guild = await services.client.guilds.fetch(operation.guild_id);
    if (signal.aborted) return;
    const channel = await guild.channels.fetch(operation.channel_id,{force:true});
    if (signal.aborted) return;
    if (channel?.isTextBased()) { await channel.send(payload); return; }
  } catch (error) { services.logger.error('Could not send moderation restoration notice to its channel.',error); }
  if (signal.aborted) return;
  try {
    const actor = await services.client.users.fetch(operation.actor_id);
    if (signal.aborted) return;
    await actor.send(payload);
  }
  catch (error) { services.logger.error('Could not send moderation restoration notice to its actor.',error); }
}
export function createRestoreHandler(services: RuntimeServices, kind: 'role' | 'permission'): ScheduledHandler {
  return async (job, signal) => {
    signal.throwIfAborted();
    if (!job.payload || typeof job.payload !== 'object' || !('operationId' in job.payload) || typeof job.payload.operationId !== 'string') throw new Error('Invalid moderation job payload.');
    await activeEffects.get(services)?.get(job.payload.operationId);
    signal.throwIfAborted();
    const result = await query<OperationRow>(services.pool, 'SELECT * FROM moderation_operations WHERE id=$1 AND kind=$2', [job.payload.operationId, kind]);
    const operation = result.rows[0];
    if (!operation || ['restored','conflict','failed'].includes(operation.status)) return;
    const guild = await services.client.guilds.fetch(operation.guild_id);
    const bot = await guild.members.fetchMe({force:true});
    let current: State;
    let action: () => Promise<unknown>;
    if (kind === 'permission') {
      const channel = await guild.channels.fetch(operation.channel_id,{force:true});
      if (!channel || !('permissionOverwrites' in channel)) throw new Error('Restoration channel unavailable.');
      const permission = operation.permission && resolvePermission(operation.permission);
      if (!permission) throw new Error('Unknown persisted permission.');
      current = permissionState(channel,operation.target_id,permission);
      if (!['allow','deny','inherit'].includes(operation.previous_state)) throw new Error('Invalid permission snapshot.');
      action = async () => {
        await guild.roles.fetch();
        if (!channel.permissionsFor(bot)?.has([PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles])) throw new Error('Bot lacks target channel restoration permissions.');
        const targetRole = await guild.roles.fetch(operation.target_id);
        const targetMember = targetRole ? null : await guild.members.fetch({user:operation.target_id,force:true});
        if (operation.target_id !== guild.id && (targetMember?.id === guild.ownerId || bot.roles.highest.comparePositionTo(targetRole ?? targetMember!.roles.highest) <= 0)) throw new Error('Restoration target exceeds bot hierarchy.');
        signal.throwIfAborted();
        return channel.permissionOverwrites.edit(operation.target_id,{[permission]:permissionValue(operation.previous_state as PermissionState)}, {reason:`Restore moderation operation ${operation.id}`});
      };
    } else {
      if (!operation.role_id) throw new Error('Missing persisted role.');
      const member = await guild.members.fetch({user:operation.target_id,force:true});
      current = member.roles.cache.has(operation.role_id) ? 'present' : 'absent';
      action = async () => {
        await guild.roles.fetch();
        const role = await guild.roles.fetch(operation.role_id!);
        if (!role || role.managed || !bot.permissions.has(PermissionFlagsBits.ManageRoles) || bot.roles.highest.comparePositionTo(role) <= 0 || bot.roles.highest.comparePositionTo(member.roles.highest) <= 0 || member.id === guild.ownerId) throw new Error('Role restoration is blocked by hierarchy or permissions.');
        signal.throwIfAborted();
        return operation.previous_state === 'present' ? member.roles.add(role.id,`Restore moderation operation ${operation.id}`) : member.roles.remove(role.id,`Restore moderation operation ${operation.id}`);
      };
    }
    const decision = restorationDecision(operation.previous_state,operation.applied_state,current,operation.status);
    signal.throwIfAborted();
    if (decision === 'restore') await action();
    await query(services.pool,'UPDATE moderation_operations SET status=$2 WHERE id=$1',[operation.id,decision === 'conflict' ? 'conflict' : 'restored']);
    await restorationNotice(services,operation,decision === 'conflict',signal);
  };
}

export async function reconcilePermanentIntents(services: RuntimeServices): Promise<void> {
  const result=await query<OperationRow>(services.pool, `SELECT * FROM moderation_operations WHERE status='intent' AND restore_at IS NULL AND created_at < $1`,[new Date(services.startedAt)]);
  for (const operation of result.rows) {
    try {
      const guild=await services.client.guilds.fetch(operation.guild_id);
      let current:State;
      if (operation.kind==='permission') {
        const permission=operation.permission && resolvePermission(operation.permission);
        const channel=await guild.channels.fetch(operation.channel_id,{force:true});
        if (!permission || !channel || !('permissionOverwrites' in channel)) throw new Error('Cannot inspect the pending permission operation.');
        current=permissionState(channel,operation.target_id,permission);
      } else {
        const member=await guild.members.fetch({user:operation.target_id,force:true});
        if (!operation.role_id) throw new Error('Pending role operation has no role.');
        current=member.roles.cache.has(operation.role_id)?'present':'absent';
      }
      const status=current===operation.applied_state?'applied':current===operation.previous_state?'failed':'conflict';
      await query(services.pool,`UPDATE moderation_operations SET status=$2 WHERE id=$1 AND status='intent'`,[operation.id,status]);
    } catch(error) {
      services.logger.error('Could not reconcile a permanent moderation intent.',error);
    }
  }
}
