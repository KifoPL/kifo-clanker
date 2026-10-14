import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PermissionFlagsBits, type ChatInputCommandInteraction, type Message } from 'discord.js';
import type { Pool } from 'pg';
import type { CommandInvocation } from '../../src/contracts/invocation.js';
import type { TextChannel } from 'discord.js';
import type { RuntimeServices } from '../../src/contracts/features.js';
import { automationFeature } from '../../src/features/automation/index.js';
import { archiveMinutes, confirm, requireChannel, recheckPermissions, requireCommandPermissions } from '../../src/features/automation/shared.js';
import { threadTitle } from '../../src/features/automation/autothreading.js';

function fixture(settings: Record<string, unknown[]> = {}) {
  const queries: string[] = [];
  const effects: string[] = [];
  const services = {
    pool: {async query(sql: string) { queries.push(sql); return {rows:settings[sql.match(/FROM (\w+)/)?.[1] ?? ''] ?? [],rowCount:0}; }} as unknown as Pool,
    client:{user:{id:'bot'},emojis:{cache:new Map()}},logger:{error() {}},
  } as unknown as RuntimeServices;
  const runtime = automationFeature.create(services);
  const member = {displayName:'Member',permissionsIn:()=>({has:()=>false})};
  const message = {
    guild:{id:'guild',name:'Server',roles:{fetch:async()=>new Map()},channels:{fetch:async()=>message.channel},members:{fetchMe:async()=>({permissionsIn:()=>({has:()=>true})}),fetch:async()=>message.member}},
    channel:{id:'channel',name:'general-chat',isTextBased:()=>true,isThread:()=>false},channelId:'channel',guildId:'guild',author:{id:'user',username:'User',bot:false,send:async()=>{effects.push('dm');}},member,
    content:'Hello',createdTimestamp:1000,embeds:[],components:[],hasThread:false,
    delete:async()=>{effects.push('delete');},react:async()=>{effects.push('react');},
    startThread:async()=>{effects.push('thread');return {setRateLimitPerUser:async()=>{effects.push('slowmode');}}},
  } as unknown as Message;
  return {runtime,queries,effects,message,services};
}

function nativeInteraction(f: ReturnType<typeof fixture>,action:string,values:Record<string,string>={}): ChatInputCommandInteraction {
  return {id:'command',channel:f.message.channel,channelId:f.message.channelId,guild:f.message.guild,guildId:f.message.guildId,client:f.services.client,user:f.message.author,
    options:{getSubcommand:()=>action,getString:(name:string)=>values[name] ?? null},
    deferReply:async()=>{},editReply:async()=>({react:async()=>{f.effects.push('probe-reaction');}}),followUp:async()=>({react:async()=>{f.effects.push('probe-reaction');}}),
  } as unknown as ChatInputCommandInteraction;
}

test('ordinary unconfigured messages make zero SQL queries after settings hydration',async()=>{
  const f = fixture(); await f.runtime.hydrate!(); assert.equal(f.queries.length,4); f.queries.length=0;
  assert.equal(await f.runtime.onMessage!(f.message),'continue'); assert.deepEqual(f.queries,[]); assert.deepEqual(f.effects,[]);
});
test('automatic reactions use hydrated cache and treat former prefix commands as ordinary messages',async()=>{
  const f = fixture({auto_reactions:[{channel_id:'channel',guild_id:'guild',emojis:['👍']}]}); await f.runtime.hydrate!(); f.queries.length=0;
  await f.runtime.onMessage!(f.message); assert.deepEqual(f.effects,['react']); assert.deepEqual(f.queries,[]);
  f.effects.length=0; f.message.content='!kifo help'; await f.runtime.onMessage!(f.message); assert.deepEqual(f.effects,['react']);f.effects.length=0;
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
  const command=f.runtime.slashCommands!.find(command=>command.data.name==='react')!;
  await assert.rejects(command.execute(nativeInteraction(f,'off')),/Database operation failed/);
  assert.equal(await f.runtime.onMessage!(f.message),'continue');
  assert.deepEqual(f.effects,['react']);

});
test('channel permission guard evaluates the target channel for both caller and bot',async()=>{
  const target={type:0,id:'target'};const calls:unknown[]=[];let replied=false;
  const interaction={channel:target,inGuild:()=>true,user:{id:'owner'},deferReply:async()=>{},guild:{roles:{fetch:async()=>new Map()},channels:{fetch:async()=>target},members:{fetch:async()=>({permissionsIn:(channel:unknown)=>{calls.push(channel);return {has:()=>true};}}),fetchMe:async()=>({permissionsIn:(channel:unknown)=>{calls.push(channel);return {has:()=>false};}})}},reply:async()=>{replied=true;}} as unknown as ChatInputCommandInteraction;
  assert.equal(await requireChannel(interaction,[1n],[2n]),null);assert.deepEqual(calls,[target,target]);assert.equal(replied,true);
});
test('former bare prefixes are ordinary cooldown-controlled messages',async()=>{
  const f=fixture({superslow_settings:[{channel_id:'channel',guild_id:'guild',duration_ms:21600000}],superslow_users:[{timestamp_ms:'0'}]});await f.runtime.hydrate!();f.queries.length=0;f.message.content='!kifo';
  assert.equal(await f.runtime.onMessage!(f.message),'deleted');assert.equal(f.queries.length,2);assert.match(f.queries[0]!,/^INSERT/);assert.match(f.queries[1]!,/^SELECT/);assert.deepEqual(f.effects,['dm','delete']);
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
test('automation exposes six native slash commands with structured react and superslow options',()=>{
  const f=fixture();assert.equal('prefixCommands' in f.runtime,false);
  assert.deepEqual(automationFeature.commandData.map(command=>command.name),['ticketing','ticket','autothreading','threads','react','superslow']);
  const react=automationFeature.commandData.find(command=>command.name==='react');
  const slow=automationFeature.commandData.find(command=>command.name==='superslow');
  assert.ok(react && 'options' in react);assert.deepEqual(react.options?.map(option=>option.name),['on','off','status','list']);
  assert.ok(slow && 'options' in slow);assert.deepEqual(slow.options?.map(option=>option.name),['set','off','status','list']);
});
test('native react on validates emojis on the actual interaction response before saving',async()=>{
  const f=fixture();await f.runtime.hydrate!();f.queries.length=0;
  Object.assign(f.message,{member:{permissionsIn:()=>({has:()=>true})}});
  Object.assign(f.services.client,{emojis:{cache:new Map()}});
  const command=f.runtime.slashCommands!.find(command=>command.data.name==='react')!;
  await command.execute(nativeInteraction(f,'on',{emojis:'👍 ❤️'}));
  assert.deepEqual(f.effects,['probe-reaction','probe-reaction']);assert.equal(f.queries.length,1);assert.match(f.queries[0]!,/^INSERT INTO auto_reactions/);
});
test('native superslow off accepts its structured subcommand and deletes cooldown configuration',async()=>{
  const f=fixture();await f.runtime.hydrate!();f.queries.length=0;
  Object.assign(f.message,{member:{permissionsIn:()=>({has:()=>true})}});
  const command=f.runtime.slashCommands!.find(command=>command.data.name==='superslow')!;
  await command.execute(nativeInteraction(f,'off'));
  assert.equal(f.queries.length,1);assert.match(f.queries[0]!,/^DELETE FROM superslow_settings/);
});
test('bot_auto handles webhook messages without trying to fetch a nonexistent guild member',async()=>{
  const f=fixture({autothreading_settings:[{channel_id:'channel',guild_id:'guild',title:'Webhook discussion',bot_auto:true,slowmode_seconds:0,archive_minutes:1440}]});await f.runtime.hydrate!();
  Object.assign(f.message,{member:null,webhookId:'webhook'});f.message.author.bot=true;
  Object.assign(f.message.guild!.members,{fetch:async()=>{throw new Error('Unknown member');}});
  await f.runtime.onMessage!(f.message);assert.deepEqual(f.effects,['thread']);
});
test('reaction configuration can be disabled after bot reaction permission is revoked',async()=>{
  const f=fixture({auto_reactions:[{channel_id:'channel',guild_id:'guild',emojis:['👍']}]});await f.runtime.hydrate!();f.queries.length=0;
  Object.assign(f.message,{member:{permissionsIn:()=>({has:()=>true})}});
  Object.assign(f.message.guild!.members,{fetchMe:async()=>({permissionsIn:()=>({has:(permissions:readonly bigint[])=>permissions.length===0})})});
  await f.runtime.slashCommands!.find(command=>command.data.name==='react')!.execute(nativeInteraction(f,'off'));
  assert.match(f.queries[0] ?? '',/^DELETE FROM auto_reactions/);
});
test('private tickets only require the chosen thread creation capability',async()=>{
  const f=fixture({ticket_settings:[{channel_id:'channel',guild_id:'guild',are_public:false,slowmode_seconds:0,archive_minutes:1440}]});await f.runtime.hydrate!();
  Object.assign(f.message,{member:{displayName:'Member',permissionsIn:()=>({has:()=>true})}});
  Object.assign(f.message.guild!.members,{fetchMe:async()=>({permissionsIn:()=>({has:(permissions:readonly bigint[])=>!permissions.includes(PermissionFlagsBits.CreatePublicThreads)})})});
  let created=false;
  Object.assign(f.message.channel,{type:0,threads:{create:async()=>{created=true;return {id:'private',members:{add:async()=>{}},send:async()=>{}};}}});
  Object.assign(f.message.author,{tag:'member',displayAvatarURL:()=> 'https://cdn.discordapp.com/avatar.png'});
  const interaction=nativeInteraction(f,'',{title:'Question'});Object.assign(interaction,{inGuild:()=>true,reply:async()=>{}});
  await f.runtime.slashCommands!.find(command=>command.data.name==='ticket')!.execute(interaction);
  assert.equal(created,true);
});
test('ticket starter messages cannot race with bot_auto thread creation',async()=>{
  const f=fixture({ticket_settings:[{channel_id:'channel',guild_id:'guild',are_public:true,slowmode_seconds:0,archive_minutes:1440}],autothreading_settings:[{channel_id:'channel',guild_id:'guild',title:'[member]',bot_auto:true,slowmode_seconds:0,archive_minutes:1440}]});await f.runtime.hydrate!();
  f.message.author.id='bot';f.message.author.bot=true;
  await f.runtime.onMessage!(f.message);assert.deepEqual(f.effects,[]);
});
test('configuration reload cannot erase a command committed while its queries were running',async()=>{
  const settings:Record<string,unknown[]>={auto_reactions:[]};const f=fixture(settings);
  Object.assign(f.message,{member:{permissionsIn:()=>({has:()=>true})}});Object.assign(f.services.client,{emojis:{cache:new Map()}});
  let release!:()=>void;const blocked=new Promise<void>(resolve=>{release=resolve;});let paused=false;
  f.services.pool.query=(async(sql:string)=>{
    if(sql.startsWith('INSERT INTO auto_reactions')) {settings.auto_reactions=[{channel_id:'channel',guild_id:'guild',emojis:['👍']}];return {rows:[],rowCount:1};}
    const table=sql.match(/FROM (\w+)/)?.[1] ?? '';
    const rows=settings[table] ?? [];
    if(table==='auto_reactions' && !paused) {paused=true;await blocked;}
    return {rows,rowCount:rows.length};
  }) as Pool['query'];
  const reloading=f.runtime.hydrate!();
  await f.runtime.slashCommands!.find(command=>command.data.name==='react')!.execute(nativeInteraction(f,'on',{emojis:'👍'}));
  release();await reloading;f.effects.length=0;
  await f.runtime.onMessage!(f.message);assert.deepEqual(f.effects,['react']);
});
test('channel authorization acknowledges the interaction before guild-member network work',async()=>{
  let acknowledged=false;
  const target={type:0,id:'target'};
  const interaction={channel:target,inGuild:()=>true,user:{id:'owner'},deferReply:async()=>{acknowledged=true;},guild:{roles:{fetch:async()=>new Map()},channels:{fetch:async()=>target},members:{fetch:async()=>{assert.equal(acknowledged,true);return {permissionsIn:()=>({has:()=>true})};},fetchMe:async()=>({permissionsIn:()=>({has:()=>true})})}},reply:async()=>{},editReply:async()=>{}} as unknown as ChatInputCommandInteraction;
  assert.equal(await requireChannel(interaction,[],[]),target);
});
test('ticketing and autothreading can be disabled after bot thread capabilities are revoked',async()=>{
  for(const [name,table,row] of [
    ['ticketing','ticket_settings',{channel_id:'channel',guild_id:'guild',are_public:true,slowmode_seconds:0,archive_minutes:1440}],
    ['autothreading','autothreading_settings',{channel_id:'channel',guild_id:'guild',title:'[member]',bot_auto:false,slowmode_seconds:0,archive_minutes:1440}],
  ] as const) {
    const f=fixture({[table]:[row]});await f.runtime.hydrate!();f.queries.length=0;
    Object.assign(f.message,{member:{permissionsIn:()=>({has:()=>true})}});Object.assign(f.message.channel,{type:0,id:'channel',guild:f.message.guild});
    Object.assign(f.message.guild!.members,{fetchMe:async()=>({permissionsIn:()=>({has:(permissions:readonly bigint[])=>permissions.length===0})})});
    const interaction=nativeInteraction(f,'off');Object.assign(interaction,{inGuild:()=>true,
      deferReply:async()=>{Object.assign(interaction,{deferred:true});},
      fetchReply:async()=>({awaitMessageComponent:async()=>({customId:`automation:command:${name}-off:yes`,deferUpdate:async()=>{}})}),
    });
    await f.runtime.slashCommands!.find(command=>command.data.name===name)!.execute(interaction);
    assert.match(f.queries[0] ?? '',new RegExp(`^DELETE FROM ${table}`));
    f.queries.length=0;await f.runtime.onMessage!(f.message);assert.deepEqual(f.queries,[]);assert.deepEqual(f.effects,[]);
  }
});
test('superslow can be disabled after bot moderation permissions are revoked',async()=>{
  const f=fixture({superslow_settings:[{channel_id:'channel',guild_id:'guild',duration_ms:21600000}]});await f.runtime.hydrate!();f.queries.length=0;
  Object.assign(f.message,{member:{permissionsIn:()=>({has:()=>true})}});
  Object.assign(f.message.guild!.members,{fetchMe:async()=>({permissionsIn:()=>({has:(permissions:readonly bigint[])=>permissions.length===0})})});
  await f.runtime.slashCommands!.find(command=>command.data.name==='superslow')!.execute(nativeInteraction(f,'off'));
  assert.match(f.queries[0] ?? '',/^DELETE FROM superslow_settings/);
});
test('reaction status renders custom emojis instead of exposing only their numeric IDs',async()=>{
  const id='123456789012345678';const emoji=`<:custom:${id}>`;
  const f=fixture({auto_reactions:[{channel_id:'channel',guild_id:'guild',emojis:[id]}]});await f.runtime.hydrate!();
  Object.assign(f.message,{member:{permissionsIn:()=>({has:()=>true})}});Object.assign(f.services.client,{emojis:{cache:new Map([[id,{toString:()=>emoji}]])}});
  let output:unknown;const interaction=nativeInteraction(f,'status');Object.assign(interaction,{editReply:async(body:unknown)=>{output=body;}});
  await f.runtime.slashCommands!.find(command=>command.data.name==='react')!.execute(interaction);
  assert.deepEqual(output,{content:emoji});
});
test('post-confirmation authorization fetches fresh channel overwrites and forces both members',async()=>{
  const calls:unknown[]=[];let replied=false;
  const fresh={id:'target',type:0,revoked:true};
  const member={permissionsIn:(channel:{revoked?:boolean})=>({has:()=>!channel.revoked})};
  const guild={roles:{fetch:async()=>{calls.push('roles');}},channels:{fetch:async(id:string,options:unknown)=>{calls.push([id,options]);return fresh;}},members:{fetch:async(options:unknown)=>{calls.push(options);return member;},fetchMe:async(options:unknown)=>{calls.push(options);return member;}}};
  const captured={id:'target',type:0,guild,revoked:false} as unknown as TextChannel;
  const interaction={user:{id:'owner'},editReply:async()=>{replied=true;}} as unknown as ChatInputCommandInteraction;
  assert.equal(await recheckPermissions(interaction,captured,[1n],[2n]),false);assert.equal(replied,true);
  assert.ok(calls.includes('roles'));assert.ok(calls.some(value=>JSON.stringify(value)===JSON.stringify(['target',{force:true}])));
  assert.ok(calls.some(value=>JSON.stringify(value)===JSON.stringify({user:'owner',force:true})));assert.ok(calls.some(value=>JSON.stringify(value)===JSON.stringify({force:true})));
});
test('initial authorization refreshes permission bits of unchanged guild role IDs',async()=>{
  let rolePermission=true;const member={permissionsIn:()=>({has:()=>rolePermission})};
  const channel={id:'target',type:0};
  const guild={roles:{fetch:async()=>{rolePermission=false;}},channels:{fetch:async()=>channel},members:{fetch:async()=>member,fetchMe:async()=>member}};
  const interaction={channel,channelId:'target',guild,inGuild:()=>true,user:{id:'owner'},deferReply:async()=>{},editReply:async()=>{},reply:async()=>{}} as unknown as ChatInputCommandInteraction;
  assert.equal(await requireChannel(interaction,[PermissionFlagsBits.ManageThreads],[]),null);assert.equal(rolePermission,false);
});
test('invocation permission gates ignore a cached permitted member when forced refresh denies access',async()=>{
  let memberOptions:unknown;let botOptions:unknown;let roleRefreshed=false;
  const invocation={author:{id:'owner'},member:{permissionsIn:()=>({has:()=>true})},channelId:'target',reply:async()=>{},guild:{roles:{fetch:async()=>{roleRefreshed=true;}},channels:{fetch:async()=>({id:'target',isThread:()=>false,isTextBased:()=>true})},members:{fetch:async(options:unknown)=>{memberOptions=options;return {permissionsIn:()=>({has:()=>false})};},fetchMe:async(options:unknown)=>{botOptions=options;return {permissionsIn:()=>({has:()=>true})};}}}} as unknown as CommandInvocation;
  assert.equal(await requireCommandPermissions(invocation,[]),false);assert.deepEqual(memberOptions,{user:'owner',force:true});assert.deepEqual(botOptions,{force:true});assert.equal(roleRefreshed,true);
});
test('invocation thread authorization refreshes inherited parent overwrites before evaluating permissions',async()=>{
  let granted=true;const calls:unknown[]=[];
  const member={permissionsIn:()=>({has:()=>granted})};
  const thread={id:'thread',parentId:'parent',isThread:()=>true,isTextBased:()=>true};
  const invocation={author:{id:'owner'},member,channelId:'thread',reply:async()=>{},guild:{roles:{fetch:async()=>{}},channels:{fetch:async(id:string,options:unknown)=>{calls.push([id,options]);if(id==='parent') {granted=false;return {id:'parent'};}return thread;}},members:{fetch:async()=>member,fetchMe:async()=>member}}} as unknown as CommandInvocation;
  assert.equal(await requireCommandPermissions(invocation,[]),false);assert.deepEqual(calls,[['thread',{force:true}],['parent',{force:true}]]);
});
