import { randomUUID } from 'node:crypto';
import { PermissionFlagsBits, type Guild, type GuildChannel } from 'discord.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { query, withTransaction, enqueueJob } from '../../db/index.js';
import type { ScheduledHandler } from '../../scheduler/index.js';
import { permissionState, permissionValue, resolvePermission, type PermissionName, type PermissionState } from './permissions.js';

type State = PermissionState | 'present' | 'absent' | 'unknown';
export interface OperationRow {
  id: string; kind: 'permission' | 'role'; guild_id: string; channel_id: string;
  target_id: string; role_id: string | null; permission: string | null;
  previous_state: State; applied_state: State; actor_id: string; message_id: string;
  restore_at: Date | null; status: 'intent' | 'applied' | 'restored' | 'conflict' | 'failed';
}
interface Mutation {
  guild: Guild; channel: GuildChannel; targetId: string; actorId: string; messageId: string; restoreAt?: Date;
}
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
  try { await action(); }
  catch (error) {
    // A network failure may follow a successful Discord effect. Keep temporary intent for reconciliation.
    await query(services.pool, `UPDATE moderation_operations SET status=CASE WHEN restore_at IS NULL THEN 'failed' ELSE 'intent' END WHERE id=$1`, [id]);
    throw error;
  }
  await query(services.pool, `UPDATE moderation_operations SET status='applied' WHERE id=$1`, [id]);
}
export async function setTemporaryPermission(services: RuntimeServices, mutation: Mutation & {permission: PermissionName; state: PermissionState}): Promise<void> {
  const channel = await mutation.channel.fetch(true);
  const previous = permissionState(channel,mutation.targetId,mutation.permission);
  const id = await persistIntent(services,mutation,'permission',previous,mutation.state,mutation.permission,null);
  await apply(services,id, () => channel.permissionOverwrites.edit(mutation.targetId, {[mutation.permission]: permissionValue(mutation.state)}, {reason:`perms by ${mutation.actorId}; operation ${id}`}));
}
export async function removeRole(services: RuntimeServices, mutation: Mutation & {roleId: string}): Promise<void> {
  const member = await mutation.guild.members.fetch({user:mutation.targetId,force:true});
  if (!member.roles.cache.has(mutation.roleId)) throw new Error('The member does not have this role.');
  const id = await persistIntent(services,mutation,'role','present','absent',null,mutation.roleId);
  await apply(services,id, () => member.roles.remove(mutation.roleId,`remove by ${mutation.actorId}; operation ${id}`));
}
export function createRestoreHandler(services: RuntimeServices, kind: 'role' | 'permission'): ScheduledHandler {
  return async (job, signal) => {
    signal.throwIfAborted();
    if (!job.payload || typeof job.payload !== 'object' || !('operationId' in job.payload) || typeof job.payload.operationId !== 'string') throw new Error('Invalid moderation job payload.');
    const result = await query<OperationRow>(services.pool, 'SELECT * FROM moderation_operations WHERE id=$1 AND kind=$2', [job.payload.operationId, kind]);
    const operation = result.rows[0];
    if (!operation || ['restored','conflict','failed'].includes(operation.status)) return;
    const guild = await services.client.guilds.fetch(operation.guild_id);
    const channel = await guild.channels.fetch(operation.channel_id,{force:true});
    const bot = await guild.members.fetchMe({force:true});
    if (!channel || !('permissionOverwrites' in channel)) throw new Error('Restoration channel unavailable.');
    let current: State;
    let action: () => Promise<unknown>;
    if (kind === 'permission') {
      const permission = operation.permission && resolvePermission(operation.permission);
      if (!permission) throw new Error('Unknown persisted permission.');
      if (!channel.permissionsFor(bot)?.has([PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles])) throw new Error('Bot lacks target channel restoration permissions.');
      const targetRole = await guild.roles.fetch(operation.target_id);
      const targetMember = targetRole ? null : await guild.members.fetch({user:operation.target_id,force:true});
      if (operation.target_id !== guild.id && bot.roles.highest.comparePositionTo(targetRole ?? targetMember!.roles.highest) <= 0) throw new Error('Restoration target exceeds bot hierarchy.');
      current = permissionState(channel,operation.target_id,permission);
      if (!['allow','deny','inherit'].includes(operation.previous_state)) throw new Error('Invalid permission snapshot.');
      action = () => channel.permissionOverwrites.edit(operation.target_id,{[permission]:permissionValue(operation.previous_state as PermissionState)}, {reason:`Restore moderation operation ${operation.id}`});
    } else {
      if (!operation.role_id) throw new Error('Missing persisted role.');
      const member = await guild.members.fetch({user:operation.target_id,force:true});
      const role = await guild.roles.fetch(operation.role_id);
      if (!role || role.managed || !bot.permissions.has(PermissionFlagsBits.ManageRoles) || bot.roles.highest.comparePositionTo(role) <= 0 || bot.roles.highest.comparePositionTo(member.roles.highest) <= 0 || member.id === guild.ownerId) throw new Error('Role restoration is blocked by hierarchy or permissions.');
      current = member.roles.cache.has(role.id) ? 'present' : 'absent';
      action = () => operation.previous_state === 'present' ? member.roles.add(role.id,`Restore moderation operation ${operation.id}`) : member.roles.remove(role.id,`Restore moderation operation ${operation.id}`);
    }
    const decision = restorationDecision(operation.previous_state,operation.applied_state,current,operation.status);
    signal.throwIfAborted();
    if (decision === 'restore') await action();
    await query(services.pool,'UPDATE moderation_operations SET status=$2 WHERE id=$1',[operation.id,decision === 'conflict' ? 'conflict' : 'restored']);
    if (decision === 'conflict' && channel.isTextBased()) {
      await channel.send({content:`Temporary ${kind} operation ${operation.id} was not restored because its state changed or its legacy snapshot is incomplete. Please review <@${operation.actor_id}>.`,allowedMentions:{parse:[]}});
    }
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
