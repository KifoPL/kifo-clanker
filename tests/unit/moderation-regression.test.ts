import assert from 'node:assert/strict';
import test from 'node:test';
import { Collection, GuildMember, PermissionFlagsBits, PermissionsBitField, type Guild, type GuildChannel, type Role } from 'discord.js';
import type { Pool } from 'pg';
import type { RuntimeServices } from '../../src/contracts/features.js';
import type { CommandInvocation } from '../../src/contracts/invocation.js';
import { guildMembers } from '../../src/features/moderation/common.js';
import { authorizeRole } from '../../src/features/moderation/authorization.js';
import { createRestoreHandler, removeRole, setTemporaryPermission, type OperationRow } from '../../src/features/moderation/operations.js';
import type { PermissionState } from '../../src/features/moderation/permissions.js';

function regressionFixture() {
  const operations=new Map<string,OperationRow>();
  const events:string[]=[];
  let state:PermissionState='allow';
  let hasRole=true;
  let sourceDeleted=false;
  let failRefresh=false;
  let refuseFinalize=false;
  let failFailureCommit=false;
  let failAppliedCommit=false;
  let channelFetches=0;
  let connections=0;
  let firstConnectHook:(()=>Promise<void>)|undefined;
  let afterFinalize:(()=>void)|undefined;
  const notices:{content:string;allowedMentions:{parse:string[]}}[]=[];
  const directNotices:typeof notices=[];
  let channelNotice=false;
  let failChannelNotice=false;
  let failDirectNotice=false;
  const permissions=new PermissionsBitField(PermissionFlagsBits.Administrator);
  const actor={id:'actor',user:{id:'actor'},permissions,roles:{highest:{position:10,comparePositionTo:(target:{position:number})=>10-target.position}}} as unknown as GuildMember;
  const bot={id:'bot',user:{id:'bot'},permissions,roles:{highest:{position:20,comparePositionTo:(target:{position:number})=>20-target.position}}} as unknown as GuildMember;
  const target={id:'target',user:{id:'target'},roles:{highest:{position:1},cache:{has:()=>hasRole},add:async()=>{events.push('role.add');hasRole=true;},remove:async()=>{events.push('role.remove');hasRole=false;}}} as unknown as GuildMember;
  const role={id:'role',managed:false,position:1} as Role;
  const overwrite=()=>({allow:new PermissionsBitField(state==='allow'?[PermissionFlagsBits.ViewChannel]:[]),deny:new PermissionsBitField(state==='deny'?[PermissionFlagsBits.ViewChannel]:[])});
  const overwrites=new Collection([['target',overwrite()]]);
  const setState=(next:PermissionState)=>{state=next;overwrites.set('target',overwrite());};
  const channel={id:'channel',name:'target-channel',permissionOverwrites:{cache:overwrites,edit:async(_target:unknown,perms:{ViewChannel:boolean|null})=>{events.push('permission.edit');setState(perms.ViewChannel===true?'allow':perms.ViewChannel===false?'deny':'inherit');}},
    permissionsFor:(member:GuildMember)=>member.permissions,isTextBased:()=>channelNotice,
    send:async(payload:typeof notices[number])=>{events.push('channel.notice');assert.equal([...operations.values()].at(-1)?.status==='restored' || [...operations.values()].at(-1)?.status==='conflict',true);if(failChannelNotice)throw new Error('Cannot send');notices.push(payload);},
    fetch:async()=>{channelFetches++;if(failRefresh && channelFetches>1)throw new Error('Fresh snapshot unavailable');return channel;}} as unknown as GuildChannel;
  const guild={id:'guild',ownerId:'owner',channels:{fetch:async()=>{if(sourceDeleted)throw Object.assign(new Error('Unknown Channel'),{code:10003});return channel;}},
    roles:{fetch:async(id:string)=>id==='role'?role:null},members:{fetchMe:async()=>bot,fetch:async(value:string|{user:string})=>{const id=typeof value==='string'?value:value.user;return id==='actor'?actor:id==='bot'?bot:target;}}} as unknown as Guild;
  for(const value of [actor,bot,target,role,channel])Object.assign(value,{guild});
  const execute=async(sql:string,values:readonly unknown[]=[])=>{
    events.push(sql.trim().split(/\s+/u).slice(0,4).join(' '));
    if(sql.includes('SELECT id FROM moderation_operations WHERE id=$1')) {
      const record=operations.get(String(values[0]));const allowed=record?.status==='intent' && (!record.restore_at || record.restore_at.getTime()>Date.now());
      return {rows:allowed?[{id:record.id}]:[],rowCount:allowed?1:0};
    }
    if(sql.includes('SELECT id FROM moderation_operations')) {const rows=[...operations.values()].filter(record=>record.guild_id===values[0] && record.target_id===values[2] && record.kind===values[3] && (record.permission ?? record.role_id)===values[4] && (record.status==='intent' || (record.status==='applied' && record.restore_at!==null)));return {rows,rowCount:rows.length};}
    if(sql.includes('INSERT INTO moderation_operations')) {
      const record:OperationRow={id:String(values[0]),kind:values[1] as OperationRow['kind'],guild_id:String(values[2]),channel_id:String(values[3]),target_id:String(values[4]),role_id:values[5] as string|null,permission:values[6] as string|null,previous_state:values[7] as OperationRow['previous_state'],applied_state:values[8] as OperationRow['applied_state'],actor_id:String(values[9]),message_id:String(values[10]),restore_at:values[11] as Date|null,status:'intent'};
      operations.set(record.id,record);
    }
    if(sql.includes('SELECT * FROM moderation_operations'))return {rows:[...operations.values()].filter(record=>record.id===values[0]),rowCount:1};
    if(sql.includes('UPDATE moderation_operations SET previous_state')) {
      const record=operations.get(String(values[0]));if(!record || record.status!=='intent' || refuseFinalize)return {rows:[],rowCount:0};
      record.previous_state=values[1] as OperationRow['previous_state'];record.applied_state=values[2] as OperationRow['applied_state'];afterFinalize?.();return {rows:[{id:record.id}],rowCount:1};
    }
    if(sql.includes('UPDATE moderation_operations SET status=')) {
      if(failFailureCommit && sql.includes("status='failed'"))throw new Error('Failure status could not be committed');
      if(failAppliedCommit && sql.includes("status='applied'"))throw new Error('Applied acknowledgement was lost');
      const record=operations.get(String(values[0]));
      if(record && sql.includes("AND status='intent'") && record.status!=='intent')return {rows:[],rowCount:0};
      if(record)record.status=sql.includes("status='applied'")?'applied':sql.includes('status=CASE')?(record.restore_at?'intent':'failed'):sql.includes("status='failed'")?'failed':values[1] as OperationRow['status'];
    }
    if(sql.includes('INSERT INTO scheduled_jobs'))return {rows:[{id:'job'}],rowCount:1};
    return {rows:[],rowCount:0};
  };
  const connection={query:execute,release:()=>events.push('RELEASE')};
  const pool={query:execute,connect:async()=>{connections++;if(connections===1)await firstConnectHook?.();return connection;}} as unknown as Pool;
  const services={pool,client:{guilds:{fetch:async()=>guild},users:{fetch:async(id:string)=>{assert.equal(id,'actor');return {send:async(payload:typeof notices[number])=>{events.push('actor.notice');if(failDirectNotice)throw new Error('DM closed');directNotices.push(payload);}};}}},logger:{error:()=>events.push('notice.failed')}} as unknown as RuntimeServices;
  const mutation={guild,channel,targetId:'target',actorId:'actor',messageId:'command'};
  return {operations,events,services,mutation,guild,channel,actor,bot,target,role,setState,getState:()=>state,getHasRole:()=>hasRole,notices,directNotices,
    setSourceDeleted:()=>{sourceDeleted=true;},setFailRefresh:()=>{failRefresh=true;},setFirstConnectHook:(callback:()=>Promise<void>)=>{firstConnectHook=callback;},
    setRefuseFinalize:()=>{refuseFinalize=true;},setAfterFinalize:(callback:()=>void)=>{afterFinalize=callback;},
    setFailFailureCommit:()=>{failFailureCommit=true;},
    setFailAppliedCommit:()=>{failAppliedCommit=true;},
    configureNotices:(channelEnabled:boolean,channelFails=false,dmFails=false)=>{channelNotice=channelEnabled;failChannelNotice=channelFails;failDirectNotice=dmFails;},
  };
}

test('temporary role restoration succeeds even after the original command channel was deleted',async()=>{
  const f=regressionFixture();await removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)});f.setSourceDeleted();
  const record=[...f.operations.values()][0]!;
  await createRestoreHandler(f.services,'role')({id:'job',type:'role_restore',payload:{operationId:record.id},attempts:1},new AbortController().signal);
  assert.equal(f.getHasRole(),true);assert.equal(record.status,'restored');
});

test('a queued temporary permission captures the completed permanent change as its prior state',async()=>{
  const f=regressionFixture();let release!:()=>void;let entered!:()=>void;
  const waiting=new Promise<void>(resolve=>{entered=resolve;});const gate=new Promise<void>(resolve=>{release=resolve;});
  f.setFirstConnectHook(async()=>{entered();await gate;});
  const temporary=setTemporaryPermission(f.services,{...f.mutation,permission:'ViewChannel',state:'inherit',restoreAt:new Date(Date.now()+60000)});
  await waiting;await setTemporaryPermission(f.services,{...f.mutation,permission:'ViewChannel',state:'deny'});release();await temporary;
  const record=[...f.operations.values()].find(record=>record.restore_at)!;
  assert.equal(record.previous_state,'deny');assert.equal(f.getState(),'inherit');
  await createRestoreHandler(f.services,'permission')({id:'job',type:'permission_restore',payload:{operationId:record.id},attempts:1},new AbortController().signal);
  assert.equal(f.getState(),'deny');
});

test('a queued temporary role removal cannot restore a role removed permanently while awaiting admission',async()=>{
  const f=regressionFixture();let release!:()=>void;let entered!:()=>void;
  const waiting=new Promise<void>(resolve=>{entered=resolve;});const gate=new Promise<void>(resolve=>{release=resolve;});
  f.setFirstConnectHook(async()=>{entered();await gate;});
  const temporary=removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)});
  const rejection=assert.rejects(temporary,/does not have|no longer has/u);
  await waiting;await removeRole(f.services,{...f.mutation,roleId:'role'});release();await rejection;
  assert.equal(f.events.filter(event=>event==='role.remove').length,1);assert.equal(f.getHasRole(),false);
});

test('unacknowledged capture failure leaves unknown intent and never guesses how to undo a later change',async()=>{
  const f=regressionFixture();f.setFailRefresh();f.setFailFailureCommit();
  await assert.rejects(setTemporaryPermission(f.services,{...f.mutation,permission:'ViewChannel',state:'inherit',restoreAt:new Date(Date.now()+60000)}),/Database operation failed/u);
  const record=[...f.operations.values()][0]!;
  assert.equal(record.applied_state,'unknown');assert.equal(record.status,'intent');
  f.setState('deny');
  await createRestoreHandler(f.services,'permission')({id:'job',type:'permission_restore',payload:{operationId:record.id},attempts:1},new AbortController().signal);
  assert.equal(record.status,'conflict');assert.equal(f.getState(),'deny');assert.equal(f.events.includes('permission.edit'),false);
  assert.match(f.directNotices[0]!.content,/needs review/u);
});

test('terminal or expired admission cannot apply an effect after its snapshot was refused',async()=>{
  const f=regressionFixture();f.setRefuseFinalize();
  await assert.rejects(setTemporaryPermission(f.services,{...f.mutation,permission:'ViewChannel',state:'deny',restoreAt:new Date(Date.now()+60000)}),/expired or was reconciled/u);
  assert.equal(f.getState(),'allow');assert.equal(f.events.includes('permission.edit'),false);
});

test('permissions revoked while intent is committed prevent the Discord effect',async()=>{
  for(const kind of ['permission','role'] as const) {
    const f=regressionFixture();f.setAfterFinalize(()=>{Object.assign(f.actor,{permissions:new PermissionsBitField()});});
    const action=kind==='permission'?setTemporaryPermission(f.services,{...f.mutation,permission:'ViewChannel',state:'deny',restoreAt:new Date(Date.now()+60000)}):removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)});
    await assert.rejects(action,/Manage Channels|Manage Roles/u);
    assert.equal(f.events.includes('permission.edit'),false);assert.equal(f.events.includes('role.remove'),false);
    assert.equal([...f.operations.values()][0]?.status,'failed');
    // Failed preparation releases ownership, so a newly authorized attempt can proceed.
    f.setAfterFinalize(()=>{});Object.assign(f.actor,{permissions:new PermissionsBitField(PermissionFlagsBits.Administrator)});
    if(kind==='permission')await setTemporaryPermission(f.services,{...f.mutation,permission:'ViewChannel',state:'deny'});
    else await removeRole(f.services,{...f.mutation,roleId:'role'});
    assert.equal(f.events.filter(event=>event===(kind==='permission'?'permission.edit':'role.remove')).length,1);
  }
});

test('already restored roles can finish without obsolete bot management permissions',async()=>{
  const f=regressionFixture();await removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)});
  await f.target.roles.add('role');Object.assign(f.bot,{permissions:new PermissionsBitField()});
  const record=[...f.operations.values()][0]!;
  await createRestoreHandler(f.services,'role')({id:'job',type:'role_restore',payload:{operationId:record.id},attempts:1},new AbortController().signal);
  assert.equal(record.status,'restored');assert.equal(f.events.filter(event=>event==='role.add').length,1);
});

test('restoration notices follow durable completion and failures never repeat the completed effect',async()=>{
  for(const scenario of ['channel','fallback','deleted','both-fail'] as const) {
    const f=regressionFixture();f.configureNotices(true,scenario==='fallback' || scenario==='both-fail',scenario==='both-fail');
    await removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)});
    if(scenario==='deleted')f.setSourceDeleted();
    const record=[...f.operations.values()][0]!;const job={id:'job',type:'role_restore',payload:{operationId:record.id},attempts:1};
    const handler=createRestoreHandler(f.services,'role');await handler(job,new AbortController().signal);
    assert.equal(record.status,'restored');assert.equal(f.getHasRole(),true);
    if(scenario==='channel') {assert.equal(f.notices.length,1);assert.equal(f.directNotices.length,0);}
    if(scenario==='fallback' || scenario==='deleted')assert.equal(f.directNotices.length,1);
    if(scenario==='both-fail')assert.equal(f.events.filter(event=>event==='notice.failed').length,2);
    const notice=(f.notices[0] ?? f.directNotices[0]);if(notice){assert.deepEqual(notice.allowedMentions,{parse:[]});assert.match(notice.content,/prior state restored/u);}
    const effects=f.events.length;await handler(job,new AbortController().signal);
    assert.equal(f.events.filter(event=>event==='role.add').length,1);
    assert.equal(f.events.length,effects+1); // Only the terminal journal read is repeated.
  }
});

test('shutdown during an in-flight restore saves completion without beginning a later notice',async()=>{
  const f=regressionFixture();f.configureNotices(true);
  await removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)});
  const controller=new AbortController();const add=f.target.roles.add.bind(f.target.roles);
  Object.assign(f.target.roles,{add:async(id:string)=>{await add(id);controller.abort();}});
  const record=[...f.operations.values()][0]!;
  await createRestoreHandler(f.services,'role')({id:'job',type:'role_restore',payload:{operationId:record.id},attempts:1},controller.signal);
  assert.equal(record.status,'restored');assert.equal(f.getHasRole(),true);
  assert.equal(f.events.includes('channel.notice'),false);assert.equal(f.events.includes('actor.notice'),false);
});

test('a due restorer waits for an already in-flight mutation before inspecting the prior state',async()=>{
  const f=regressionFixture();let started!:()=>void;let release!:()=>void;
  const entered=new Promise<void>(resolve=>{started=resolve;});const gate=new Promise<void>(resolve=>{release=resolve;});
  const remove=f.target.roles.remove.bind(f.target.roles);
  Object.assign(f.target.roles,{remove:async(id:string)=>{started();await gate;return remove(id);}});
  const command=removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)});
  await entered;const record=[...f.operations.values()][0]!;
  record.restore_at=new Date(Date.now()-1);
  let restored=false;
  const restore=createRestoreHandler(f.services,'role')({id:'job',type:'role_restore',payload:{operationId:record.id},attempts:1},new AbortController().signal).then(()=>{restored=true;});
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(restored,false);assert.equal(f.getHasRole(),true);
  assert.equal(f.events.includes('SELECT * FROM moderation_operations'),false);
  release();await command;await restore;
  assert.equal(record.status,'restored');assert.equal(f.getHasRole(),true);
  assert.equal(f.events.filter(event=>event==='role.remove').length,1);assert.equal(f.events.filter(event=>event==='role.add').length,1);
});

test('the final server-clock admission guard rejects newly expired or terminal intents without an API call',async()=>{
  for(const scenario of ['expired','terminal'] as const) {
    const f=regressionFixture();
    f.setAfterFinalize(()=>{const record=[...f.operations.values()][0]!;if(scenario==='expired')record.restore_at=new Date(Date.now()-1);else record.status='conflict';});
    await assert.rejects(removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)}),/expired or was reconciled/u);
    assert.equal(f.getHasRole(),true);assert.equal(f.events.includes('role.remove'),false);
    assert.equal([...f.operations.values()][0]!.status,scenario==='expired'?'failed':'conflict');
  }
});

test('a post-effect database failure releases the in-process wait and leaves durable intent recoverable',async()=>{
  const f=regressionFixture();f.setFailAppliedCommit();
  await assert.rejects(removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)}),/Database operation failed/u);
  const record=[...f.operations.values()][0]!;
  assert.equal(record.status,'intent');assert.equal(f.getHasRole(),false);
  await createRestoreHandler(f.services,'role')({id:'job',type:'role_restore',payload:{operationId:record.id},attempts:1},new AbortController().signal);
  assert.equal(record.status,'restored');assert.equal(f.getHasRole(),true);
});

test('refreshing role definitions respects permission revocation without changing member roles',async()=>{
  for(const boundary of ['context','role-operation','permission-operation','restore'] as const) {
    const f=regressionFixture();
    if(boundary==='restore')await removeRole(f.services,{...f.mutation,roleId:'role',restoreAt:new Date(Date.now()+60000)});
    const member=boundary==='restore'?f.bot:f.actor;
    const definition={id:'unchanged-membership',permissions:new PermissionsBitField(PermissionFlagsBits.Administrator)};
    const assigned=new Collection([[definition.id,definition]]);
    Object.assign(member.roles,{cache:assigned});
    Object.defineProperty(member,'permissions',{get:Object.getOwnPropertyDescriptor(GuildMember.prototype,'permissions')!.get!.bind(member)});
    Object.assign(f.guild.roles,{fetch:async(id?:string)=>{
      if(id)return id==='role'?f.role:null;
      f.events.push('roles.refresh');definition.permissions=new PermissionsBitField();return new Collection();
    }});
    assert.equal(member.permissions.has(PermissionFlagsBits.ManageRoles),true);
    if(boundary==='context') {
      const context=await guildMembers({guild:f.guild,author:{id:'actor'}} as unknown as CommandInvocation);
      assert.throws(()=>authorizeRole(context.actor,context.bot,f.role),/Manage Roles/u);
    } else if(boundary==='restore') {
      const record=[...f.operations.values()][0]!;
      await assert.rejects(createRestoreHandler(f.services,'role')({id:'job',type:'role_restore',payload:{operationId:record.id},attempts:1},new AbortController().signal),/hierarchy or permissions/u);
      assert.equal(record.status,'applied');assert.equal(f.getHasRole(),false);assert.equal(f.events.includes('role.add'),false);
    } else {
      const attempt=boundary==='role-operation'?removeRole(f.services,{...f.mutation,roleId:'role'}):setTemporaryPermission(f.services,{...f.mutation,permission:'ViewChannel',state:'deny'});
      await assert.rejects(attempt,/Manage Roles|Manage Channels/u);
      assert.equal([...f.operations.values()][0]?.status,'failed');
      assert.equal(f.events.includes('role.remove'),false);assert.equal(f.events.includes('permission.edit'),false);
    }
    assert.equal(f.events.includes('roles.refresh'),true);
    assert.deepEqual([...assigned.keys()],['unchanged-membership']);
    assert.equal(member.permissions.has(PermissionFlagsBits.ManageRoles),false);
  }
});
