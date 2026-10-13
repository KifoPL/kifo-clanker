import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { Pool } from 'pg';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { automationFeature } from '../../src/features/automation/index.js';
import { archiveMinutes, confirm, requireChannel } from '../../src/features/automation/shared.js';
import { threadTitle } from '../../src/features/automation/autothreading.js';

function fixture(settings: Record<string, unknown[]> = {}) {
  const queries: string[] = [];
  const effects: string[] = [];
  const services = {
    pool: {async query(sql: string) { queries.push(sql); return {rows:settings[sql.match(/FROM (\w+)/)?.[1] ?? ''] ?? [],rowCount:0}; }} as unknown as Pool,
    client:{user:{id:'bot'}},prefixes:new Map(),logger:{error() {}},
  } as unknown as RuntimeServices;
  const runtime = automationFeature.create(services);
  const member = {displayName:'Member',permissionsIn:()=>({has:()=>false})};
  const message = {
    guild:{id:'guild',name:'Server',members:{fetchMe:async()=>({permissionsIn:()=>({has:()=>true})}),fetch:async()=>member}},
    channel:{name:'general-chat'},channelId:'channel',guildId:'guild',author:{id:'user',username:'User',bot:false,send:async()=>{effects.push('dm');}},member,
    content:'Hello',createdTimestamp:1000,embeds:[],components:[],hasThread:false,
    delete:async()=>{effects.push('delete');},react:async()=>{effects.push('react');},
    startThread:async()=>{effects.push('thread');return {setRateLimitPerUser:async()=>{effects.push('slowmode');}}},
  } as unknown as Message;
  return {runtime,queries,effects,message,services};
}

test('ordinary unconfigured messages make zero SQL queries after settings hydration',async()=>{
  const f = fixture(); await f.runtime.hydrate!(); assert.equal(f.queries.length,4); f.queries.length=0;
  assert.equal(await f.runtime.onMessage!(f.message),'continue'); assert.deepEqual(f.queries,[]); assert.deepEqual(f.effects,[]);
});
test('automatic reactions use hydrated cache and exclude commands and other bots',async()=>{
  const f = fixture({auto_reactions:[{channel_id:'channel',guild_id:'guild',emojis:['👍']}]}); await f.runtime.hydrate!(); f.queries.length=0;
  await f.runtime.onMessage!(f.message); assert.deepEqual(f.effects,['react']); assert.deepEqual(f.queries,[]);
  f.effects.length=0; f.message.content='!kifo help'; await f.runtime.onMessage!(f.message); assert.deepEqual(f.effects,[]);
  f.message.content='Hi'; f.message.author.bot=true; await f.runtime.onMessage!(f.message); assert.deepEqual(f.effects,[]);
});
test('own bot embeds receive automatic reactions',async()=>{
  const f=fixture({auto_reactions:[{channel_id:'channel',guild_id:null,emojis:['👍']}]});await f.runtime.hydrate!();
  f.message.author.id='bot';f.message.author.bot=true;Object.assign(f.message,{embeds:[{title:'Saved'}]});
  await f.runtime.onMessage!(f.message);assert.deepEqual(f.effects,['react']);
});
test('ticket filter deletes nonmoderator chatter and sends the guide before later automations',async()=>{
  const f=fixture({ticket_settings:[{channel_id:'channel',guild_id:'guild',are_public:true,slowmode_seconds:0,archive_minutes:1440}],auto_reactions:[{channel_id:'channel',guild_id:'guild',emojis:['👍']}]});await f.runtime.hydrate!();f.queries.length=0;
  assert.equal(await f.runtime.onMessage!(f.message),'deleted');assert.deepEqual(f.effects,['dm','delete']);assert.deepEqual(f.queries,[]);
});
test('automatic threading respects bot settings and skips interactive messages',async()=>{
  const f=fixture({autothreading_settings:[{channel_id:'channel',guild_id:'guild',title:'[member]',bot_auto:false,slowmode_seconds:5,archive_minutes:1440}]});await f.runtime.hydrate!();f.queries.length=0;
  f.message.author.bot=true;await f.runtime.onMessage!(f.message);assert.deepEqual(f.effects,[]);
  f.message.author.bot=false;await f.runtime.onMessage!(f.message);assert.deepEqual(f.effects,['thread','slowmode']);assert.deepEqual(f.queries,[]);
  f.effects.length=0;Object.assign(f.message,{components:[{}]});await f.runtime.onMessage!(f.message);assert.deepEqual(f.effects,[]);
});
test('title templates replace every placeholder and respect Discord 100 character limit',()=>{
  const f=fixture();assert.equal(threadTitle('[member] [member] in [channel] on [server] [embed_t]',f.message),'Member Member in general chat on Server n/a');assert.equal(threadTitle('a'.repeat(150),f.message).length,100);assert.equal(threadTitle(' ',f.message),'Discussion');
});
test('one day archiving is 1440 minutes',()=>{assert.equal(archiveMinutes('1d'),1440);assert.throws(()=>archiveMinutes('invalid'));});
test('confirmation collector is bound to initiating user, interaction, action and 30 seconds',async()=>{
  let reply: unknown;
  const interaction={id:'interaction',user:{id:'owner'},replied:false,deferred:false,reply:async(options:unknown)=>{reply=options;},editReply:async()=>{},fetchReply:async()=>({awaitMessageComponent:async(options:{time:number;filter:(candidate:{user:{id:string};customId:string})=>boolean})=>{
    assert.equal(options.time,30_000);
    assert.equal(options.filter({user:{id:'other'},customId:'automation:interaction:enable:yes'}),false);
    assert.equal(options.filter({user:{id:'owner'},customId:'automation:interaction:other:yes'}),false);
    assert.equal(options.filter({user:{id:'owner'},customId:'automation:interaction:enable:yes'}),true);
    return {customId:'automation:interaction:enable:yes',deferUpdate:async()=>{}};
  }})} as unknown as ChatInputCommandInteraction;
  assert.equal(await confirm(interaction,'Enable?','enable'),true);assert.ok(reply);
});
test('guild channel guard rejects DMs before checking permissions',async()=>{
  let replied=false;const interaction={inGuild:()=>false,reply:async()=>{replied=true;}} as unknown as ChatInputCommandInteraction;
  assert.equal(await requireChannel(interaction,[],[]),null);assert.equal(replied,true);
});
test('failed configuration writes leave hydrated cache unchanged',async()=>{
  const f=fixture({auto_reactions:[{channel_id:'channel',guild_id:'guild',emojis:['👍']}]});await f.runtime.hydrate!();
  Object.assign(f.message,{reply:async()=>{},member:{permissionsIn:()=>({has:()=>true})}});
  f.services.pool.query = (async()=>{throw new Error('offline');}) as Pool['query'];
  const command=f.runtime.prefixCommands!.find(command=>command.name==='react')!;
  await assert.rejects(command.execute(f.message,['off']),/Database operation failed/);
  assert.equal(await f.runtime.onMessage!(f.message),'continue');
  assert.deepEqual(f.effects,['react']);

});
test('channel permission guard evaluates the target channel for both caller and bot',async()=>{
  const target={type:0,id:'target'};const calls:unknown[]=[];let replied=false;
  const interaction={channel:target,inGuild:()=>true,user:{id:'owner'},guild:{members:{fetch:async()=>({permissionsIn:(channel:unknown)=>{calls.push(channel);return {has:()=>true};}}),fetchMe:async()=>({permissionsIn:(channel:unknown)=>{calls.push(channel);return {has:()=>false};}})}},reply:async()=>{replied=true;}} as unknown as ChatInputCommandInteraction;
  assert.equal(await requireChannel(interaction,[1n],[2n]),null);assert.deepEqual(calls,[target,target]);assert.equal(replied,true);
});
test('bare prefix cooldown check never consumes a superslow claim',async()=>{
  const f=fixture({superslow_settings:[{channel_id:'channel',guild_id:'guild',duration_ms:21600000}],superslow_users:[{timestamp_ms:'0'}]});await f.runtime.hydrate!();f.queries.length=0;f.message.content='!kifo';
  assert.equal(await f.runtime.onMessage!(f.message),'deleted');assert.equal(f.queries.length,1);assert.match(f.queries[0]!,/^SELECT/);assert.deepEqual(f.effects,['dm','delete']);
});
test('successful configuration reload removes settings deleted from all four tables',async()=>{
  const settings: Record<string,unknown[]>={
    auto_reactions:[{channel_id:'channel',guild_id:'guild',emojis:['👍']}],
    superslow_settings:[{channel_id:'channel',guild_id:'guild',duration_ms:21600000}],
    ticket_settings:[{channel_id:'channel',guild_id:'guild',are_public:true,slowmode_seconds:0,archive_minutes:1440}],
    autothreading_settings:[{channel_id:'channel',guild_id:'guild',title:'[member]',bot_auto:false,slowmode_seconds:0,archive_minutes:1440}],
  };
  const f=fixture(settings);await f.runtime.hydrate!();
  for(const table of Object.keys(settings)) settings[table]=[];
  await f.runtime.hydrate!();f.queries.length=0;
  assert.equal(await f.runtime.onMessage!(f.message),'continue');assert.deepEqual(f.effects,[]);assert.deepEqual(f.queries,[]);
});
test('failed configuration reload preserves the complete previously hydrated cache',async()=>{
  const settings:Record<string,unknown[]>={auto_reactions:[{channel_id:'channel',guild_id:'guild',emojis:['👍']}],autothreading_settings:[{channel_id:'channel',guild_id:'guild',title:'[member]',bot_auto:false,slowmode_seconds:0,archive_minutes:1440}]};
  const f=fixture(settings);await f.runtime.hydrate!();settings.auto_reactions=[];
  const original=f.services.pool.query;
  f.services.pool.query=(async(sql:string)=>{
    if(sql.includes('FROM autothreading_settings')) throw new Error('offline');
    return original(sql);
  }) as Pool['query'];
  await assert.rejects(f.runtime.hydrate!(),/Database operation failed/);
  await f.runtime.onMessage!(f.message);assert.deepEqual(f.effects,['react','thread']);
});
