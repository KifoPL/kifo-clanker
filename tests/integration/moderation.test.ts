import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Collection, PermissionFlagsBits, PermissionsBitField, type Guild, type GuildChannel, type GuildMember } from 'discord.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { createPool, query, runMigrations } from '../../src/db/index.js';
import { createRestoreHandler, removeRole, setTemporaryPermission } from '../../src/features/moderation/operations.js';
import type { PermissionState } from '../../src/features/moderation/permissions.js';

const databaseUrl=process.env['DATABASE_URL'];
test('PostgreSQL moderation serializes intent, recovers ambiguous effects, and preserves changed overwrites', {skip:!databaseUrl,timeout:30_000},async()=>{
  const admin=createPool(databaseUrl!,1);
  const schema=`kifo_moderation_${randomUUID().replaceAll('-','')}`;
  const isolatedUrl=new URL(databaseUrl!);
  isolatedUrl.searchParams.set('options',`-c search_path=${schema}`);
  const pool=createPool(isolatedUrl.toString());
  try {
    await query(admin,`CREATE SCHEMA ${schema}`);
    await runMigrations(pool);
    let state:PermissionState='deny';
    let actions=0;
    let ambiguousFailure=false;
    const overwrites=new Collection<string,{allow:PermissionsBitField;deny:PermissionsBitField}>();
    const updateSnapshot=()=>overwrites.set('member',{allow:new PermissionsBitField(state==='allow'?[PermissionFlagsBits.ViewChannel]:[]),deny:new PermissionsBitField(state==='deny'?[PermissionFlagsBits.ViewChannel]:[])});
    updateSnapshot();
    const member={id:'member',roles:{highest:{position:1}}} as unknown as GuildMember;
    const bot={id:'bot',roles:{highest:{comparePositionTo:()=>20}},permissions:new PermissionsBitField([PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles])} as unknown as GuildMember;
    const target={
      id:'channel',
      permissionsFor:()=>new PermissionsBitField([PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles]),
      permissionOverwrites:{cache:overwrites,edit:async(_id:string,permissions:{ViewChannel:boolean|null})=>{
        // Durable intent must be visible from another connection before the Discord request.
        const intent=await query(pool,`SELECT id FROM moderation_operations WHERE status IN ('intent','applied')`);
        assert.ok(intent.rowCount && intent.rowCount>0);
        actions++;
        state=permissions.ViewChannel===true?'allow':permissions.ViewChannel===false?'deny':'inherit';
        updateSnapshot();
        if(ambiguousFailure){ambiguousFailure=false;throw new Error('Response lost after Discord applied the overwrite.');}
      }},
      fetch:async()=>target,
      isTextBased:()=>false,
    } as unknown as GuildChannel;
    const guild={id:'guild',ownerId:'owner',channels:{fetch:async()=>target},roles:{fetch:async()=>null},members:{fetch:async()=>member,fetchMe:async()=>bot}} as unknown as Guild;
    Object.assign(target,{guild});
    const services={pool,client:{guilds:{fetch:async()=>guild}}} as unknown as RuntimeServices;
    const mutation={guild,channel:target,targetId:'member',permission:'ViewChannel' as const,state:'allow' as const,actorId:'actor',messageId:'message',restoreAt:new Date(Date.now()+60_000)};
    const concurrent=await Promise.allSettled([setTemporaryPermission(services,mutation),setTemporaryPermission(services,mutation)]);
    assert.equal(concurrent.filter(value=>value.status==='fulfilled').length,1);
    assert.equal(concurrent.filter(value=>value.status==='rejected').length,1);
    assert.equal(actions,1);
    assert.equal((await query(pool,'SELECT id FROM moderation_operations')).rowCount,1);
    assert.equal((await query(pool,'SELECT id FROM scheduled_jobs')).rowCount,1);
    const first=(await query<{id:string}>(pool,'SELECT id FROM moderation_operations')).rows[0]!;
    // A new runtime restores persisted work without any in-memory command state.
    await createRestoreHandler(services,'permission')({id:'job',type:'permission_restore',payload:{operationId:first.id},attempts:1},new AbortController().signal);
    assert.equal(state,'deny');
    assert.equal((await query<{status:string}>(pool,'SELECT status FROM moderation_operations WHERE id=$1',[first.id])).rows[0]?.status,'restored');
    ambiguousFailure=true;
    await assert.rejects(setTemporaryPermission(services,{...mutation,messageId:'second'}),/Response lost/);
    assert.equal(state,'allow');
    const intent=(await query<{id:string}>(pool,"SELECT id FROM moderation_operations WHERE status='intent'")).rows[0]!;
    assert.ok(intent);
    await createRestoreHandler(services,'permission')({id:'job2',type:'permission_restore',payload:{operationId:intent.id},attempts:1},new AbortController().signal);
    assert.equal(state,'deny');
    await setTemporaryPermission(services,{...mutation,messageId:'third'});
    const active=(await query<{id:string}>(pool,"SELECT id FROM moderation_operations WHERE status='applied'")).rows[0]!;
    state='inherit';
    updateSnapshot();
    const previousActions=actions;
    await createRestoreHandler(services,'permission')({id:'job3',type:'permission_restore',payload:{operationId:active.id},attempts:1},new AbortController().signal);
    assert.equal(state,'inherit');
    assert.equal(actions,previousActions);
    assert.equal((await query<{status:string}>(pool,'SELECT status FROM moderation_operations WHERE id=$1',[active.id])).rows[0]?.status,'conflict');
    const roles=new Collection([['role',{id:'role'}]]);
    let roleActions=0;
    Object.assign(member.roles,{cache:roles,remove:async()=>{roleActions++;roles.delete('role');}});
    const secondChannel={id:'secondchannel',guild} as GuildChannel;
    const roleMutation={guild,channel:target,targetId:'member',roleId:'role',actorId:'actor',messageId:'remove1',restoreAt:new Date(Date.now()+60_000)};
    const roleResults=await Promise.allSettled([removeRole(services,roleMutation),removeRole(services,{...roleMutation,channel:secondChannel,messageId:'remove2'})]);
    assert.equal(roleResults.filter(value=>value.status==='fulfilled').length,1);
    assert.equal(roleActions,1);
    assert.equal((await query(pool,"SELECT id FROM moderation_operations WHERE kind='role'")).rowCount,1);

  } finally {
    await pool.end();
    try {await query(admin,`DROP SCHEMA IF EXISTS ${schema} CASCADE`);} finally {await admin.end();}
  }
});
