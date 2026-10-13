import assert from 'node:assert/strict';
import test from 'node:test';
import { Collection, PermissionFlagsBits, PermissionsBitField, type Guild, type GuildChannel, type GuildMember, type Role } from 'discord.js';
import type { Pool } from 'pg';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { authorizeChannel, authorizeRole, authorizeTarget } from '../../src/features/moderation/authorization.js';
import { restorationDate, snowflake } from '../../src/features/moderation/common.js';
import { moderationFeature } from '../../src/features/moderation/index.js';
import { createRestoreHandler, restorationDecision, setTemporaryPermission } from '../../src/features/moderation/operations.js';
import { permissionState, permissionValue, resolvePermission } from '../../src/features/moderation/permissions.js';

function member(id: string, position: number): GuildMember {
  return {id,user:{id},guild:{id:'guild',ownerId:'owner'},permissions:new PermissionsBitField([PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles]),roles:{highest:{position,comparePositionTo:(role: {position:number})=>position-role.position}}} as unknown as GuildMember;
}
function role(position:number, id='role'): Role {
  return {id,position,managed:false,guild:{id:'guild',ownerId:'owner'}} as unknown as Role;
}
function fakeServices(events:string[], rows?:Record<string,unknown>, failDatabase=false): RuntimeServices {
  const execute = async (sql:string, values:readonly unknown[]) => {
    events.push(sql.trim().split(/\s+/).slice(0,4).join(' '));
    if (failDatabase && sql.includes('INSERT INTO moderation_operations')) throw new Error('offline');
    if (sql.includes('RETURNING id')) return {rows:[{id:'job'}],rowCount:1};
    if (sql.includes('SELECT * FROM moderation_operations')) return {rows:rows ? [rows] : [],rowCount:rows ? 1 : 0};
    if (sql.startsWith('UPDATE moderation_operations')) events.push(`status:${String(values[1])}`);
    return {rows:[],rowCount:0};
  };
  const connection = {query:execute,release:()=>events.push('RELEASE')};
  return {pool:{connect:async()=>connection,query:execute} as unknown as Pool} as RuntimeServices;
}
function channel(state:'allow'|'deny'|'inherit',events:string[],failDiscord=false): GuildChannel {
  const value = {id:'channel',guild:{id:'guild'},permissionOverwrites:{cache:new Collection([['target',{allow:new PermissionsBitField(state==='allow'?[PermissionFlagsBits.ViewChannel]:[]),deny:new PermissionsBitField(state==='deny'?[PermissionFlagsBits.ViewChannel]:[])}]]),edit:async(_id:string,permission:Record<string,unknown>)=>{events.push(`DISCORD:${String(permission.ViewChannel)}`);if(failDiscord)throw new Error('Discord unavailable');}},fetch:async()=>value};
  return value as unknown as GuildChannel;
}
test('legacy numeric/underscore permission names and aliases retain all 22 modes',()=>{
  assert.equal(resolvePermission('6'),'SendMessages');
  assert.equal(resolvePermission('SEND_MESSAGES'),'SendMessages');
  assert.equal(resolvePermission('USER_EXTERNAL_EMOJIS'),'UseExternalEmojis');
  assert.equal(resolvePermission('talk'),'Speak');
  assert.equal(resolvePermission('22'),'MoveMembers');
  assert.equal(resolvePermission('not-a-perm'),undefined);
});
test('permission snapshots preserve allow, deny and inherited state',()=>{
  for (const state of ['allow','deny','inherit'] as const) assert.equal(permissionState(channel(state,[]),'target','ViewChannel'),state);
  assert.equal(permissionValue('allow'),true);
  assert.equal(permissionValue('deny'),false);
  assert.equal(permissionValue('inherit'),null);
});
test('channel authorization uses target channel capabilities for both user and bot',()=>{
  const actor=member('actor',10),bot=member('bot',20);
  const blocked={name:'private',permissionsFor:(value:GuildMember)=>new PermissionsBitField(value.id==='bot'?[PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles]:[])} as unknown as GuildChannel;
  assert.throws(()=>authorizeChannel(actor,bot,blocked),/You need/);
  const botBlocked={name:'private',permissionsFor:(value:GuildMember)=>new PermissionsBitField(value.id==='actor'?[PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles]:[])} as unknown as GuildChannel;
  assert.throws(()=>authorizeChannel(actor,bot,botBlocked),/bot need/);
});
test('role and member targeting rejects equal or higher user/bot hierarchy',()=>{
  const actor=member('actor',10),bot=member('bot',20);
  assert.throws(()=>authorizeTarget(actor,bot,member('target',10)),/below your/);
  assert.throws(()=>authorizeTarget(member('owner',100),bot,member('target',20)),/below the bot/);
  assert.throws(()=>authorizeTarget(member('owner',100),bot,member('owner',1)),/owner/);
  assert.throws(()=>authorizeRole(actor,bot,role(10)),/below your/);
  assert.throws(()=>authorizeRole(member('owner',100),bot,role(20)),/below the bot/);
  authorizeRole(actor,bot,role(9));
  authorizeTarget(actor,bot,role(9));
});
test('temporary permission intent and job commit and release before the Discord effect',async()=>{
  const events:string[]=[];
  const services=fakeServices(events),target=channel('deny',events);
  await setTemporaryPermission(services,{guild:target.guild,channel:target,targetId:'target',permission:'ViewChannel',state:'allow',actorId:'actor',messageId:'message',restoreAt:new Date(100000)});
  const insert=events.findIndex(value=>value.startsWith('INSERT INTO moderation_operations'));
  const job=events.findIndex(value=>value.startsWith('INSERT INTO scheduled_jobs'));
  assert.ok(insert>=0 && job>insert);
  assert.ok(events.indexOf('COMMIT')>job);
  assert.ok(events.indexOf('DISCORD:true')>events.indexOf('RELEASE'));
});
test('database failure prevents a Discord mutation and rolls back temporary intent',async()=>{
  const events:string[]=[];
  const services=fakeServices(events,undefined,true),target=channel('inherit',events);
  await assert.rejects(setTemporaryPermission(services,{guild:target.guild,channel:target,targetId:'target',permission:'ViewChannel',state:'deny',actorId:'actor',messageId:'message',restoreAt:new Date(100000)}));
  assert.ok(events.includes('ROLLBACK'));
  assert.ok(events.includes('RELEASE'));
  assert.ok(!events.some(value=>value.startsWith('DISCORD')));
});
test('ambiguous Discord failure retains a restorable intent rather than cancelling durable recovery',async()=>{
  const events:string[]=[];
  const services=fakeServices(events),target=channel('inherit',events,true);
  await assert.rejects(setTemporaryPermission(services,{guild:target.guild,channel:target,targetId:'target',permission:'ViewChannel',state:'deny',actorId:'actor',messageId:'message',restoreAt:new Date(100000)}),/Discord unavailable/);
  assert.ok(events.some(value=>value.startsWith('UPDATE moderation_operations SET status=CASE')));
});
test('restoration preserves administrator edits and incomplete imported snapshots',()=>{
  assert.equal(restorationDecision('deny','allow','allow','applied'),'restore');
  assert.equal(restorationDecision('inherit','deny','deny','intent'),'restore');
  assert.equal(restorationDecision('deny','allow','inherit','applied'),'conflict');
  assert.equal(restorationDecision('deny','unknown','allow','applied'),'conflict');
  assert.equal(restorationDecision('present','absent','present','intent'),'done');
  assert.equal(restorationDecision('deny','allow','allow','conflict'),'done');
});
test('restoration handler detects a changed permission and does not edit Discord',async()=>{
  const events:string[]=[];
  const services=fakeServices(events,{id:'operation',kind:'permission',guild_id:'guild',channel_id:'channel',target_id:'target',role_id:null,permission:'ViewChannel',previous_state:'deny',applied_state:'allow',actor_id:'actor',message_id:'message',restore_at:new Date(),status:'applied'});
  const target=channel('inherit',events);
  Object.assign(target,{permissionsFor:()=>new PermissionsBitField([PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageRoles]),isTextBased:()=>false});
  const guild={channels:{fetch:async()=>target},members:{fetchMe:async()=>member('bot',20),fetch:async()=>member('target',1)},roles:{fetch:async()=>null}} as unknown as Guild;
  Object.assign(services,{client:{guilds:{fetch:async()=>guild}}});
  await createRestoreHandler(services,'permission')({id:'job',type:'permission_restore',payload:{operationId:'operation'},attempts:1},new AbortController().signal);
  assert.ok(events.includes('status:conflict'));
  assert.ok(!events.some(value=>value.startsWith('DISCORD')));
});
test('feature imports and construction have no database or Discord effects',()=>{
  const services=new Proxy({} as RuntimeServices,{get(){throw new Error('Construction touched services.');}});
  const runtime=moderationFeature.create(services);
  assert.deepEqual(runtime.prefixCommands?.map(value=>value.name),['clean','perms','remove']);
  assert.deepEqual(Object.keys(runtime.handlers ?? {}),['role_restore','permission_restore']);
});
test('durations and mention parsing reject malformed or unsafe inputs',()=>{
  assert.equal(restorationDate('1m',1000)?.getTime(),61000);
  for(const value of ['5s','invalid','1e20y','-1m','']) {
    if(value==='') assert.equal(restorationDate(value),undefined);
    else assert.throws(()=>restorationDate(value));
  }
  assert.equal(snowflake('<@&123456789012345678>'),'123456789012345678');
  assert.equal(snowflake('<@!123456789012345678>'),'123456789012345678');
  assert.throws(()=>snowflake('<@&123456789012345678><@9>'));
});

test('confirmation awaits only the issuing user and the exact prompt/action',async()=>{
  const {confirm}=await import('../../src/features/moderation/common.js');
  let actionId='';
  let updated=false;
  const prompt={id:'prompt',edit:async()=>{},awaitMessageComponent:async(options:{filter:(value:{user:{id:string};message:{id:string};customId:string})=>boolean})=>{
    assert.equal(options.filter({user:{id:'other'},message:{id:'prompt'},customId:actionId}),false);
    assert.equal(options.filter({user:{id:'actor'},message:{id:'otherprompt'},customId:actionId}),false);
    assert.equal(options.filter({user:{id:'actor'},message:{id:'prompt'},customId:'otheraction'}),false);
    assert.equal(options.filter({user:{id:'actor'},message:{id:'prompt'},customId:actionId}),true);
    return {customId:actionId,update:async()=>{updated=true;}};
  }};
  const message={author:{id:'actor'},reply:async(options:{components:{toJSON:()=>{components:{custom_id?:string}[]}}[]})=>{actionId=options.components[0]!.toJSON().components[0]!.custom_id!;return prompt;}} as unknown as import('discord.js').Message;
  assert.equal(await confirm(message,'deny ViewChannel for one member'),true);
  assert.ok(updated);
});

test('timed out confirmation cannot execute its action',async()=>{
  const {confirm}=await import('../../src/features/moderation/common.js');
  let expired=false;
  const message={author:{id:'actor'},reply:async()=>({id:'prompt',awaitMessageComponent:async()=>{throw new Error('timeout');},edit:async(options:{components:unknown[]})=>{assert.deepEqual(options.components,[]);expired=true;}})} as unknown as import('discord.js').Message;
  assert.equal(await confirm(message,'remove role'),false);
  assert.ok(expired);
});

test('granting a permission the actor lacks is rejected even with Manage Roles',async()=>{
  const {authorizePermissionGrant}=await import('../../src/features/moderation/authorization.js');
  const target={permissionsFor:(value:GuildMember)=>new PermissionsBitField(value.id==='bot'?[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ManageRoles]:[PermissionFlagsBits.ManageRoles])} as unknown as GuildChannel;
  assert.throws(()=>authorizePermissionGrant(member('actor',10),member('bot',20),target,PermissionFlagsBits.ViewChannel),/must have/);
});

test('restart reconciles permanent intent without undoing or repeating its Discord mutation',async()=>{
  const {reconcilePermanentIntents}=await import('../../src/features/moderation/operations.js');
  const events:string[]=[];
  const services=fakeServices(events,{id:'operation',kind:'permission',guild_id:'guild',channel_id:'channel',target_id:'target',role_id:null,permission:'ViewChannel',previous_state:'deny',applied_state:'allow',actor_id:'actor',message_id:'message',restore_at:null,status:'intent'});
  const target=channel('allow',events);
  Object.assign(services,{startedAt:Date.now(),client:{guilds:{fetch:async()=>({channels:{fetch:async()=>target}})}}});
  await reconcilePermanentIntents(services);
  assert.ok(events.includes('status:applied'));
  assert.ok(!events.some(value=>value.startsWith('DISCORD')));
});
