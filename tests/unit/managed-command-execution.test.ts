import assert from 'node:assert/strict';
import test from 'node:test';
import { Collection, ChannelType, MessageFlags, PermissionFlagsBits, PermissionsBitField, type ChatInputCommandInteraction, type Interaction, type Message, type MessageReaction, type User, type PermissionResolvable } from 'discord.js';
import type { Pool } from 'pg';
import type { FeatureDefinition, RuntimeServices } from '../../src/contracts/features.js';
import { automationFeature } from '../../src/features/automation/index.js';
import { moderationFeature } from '../../src/features/moderation/index.js';
import { menusFeature } from '../../src/features/menus/index.js';
import { MenuService } from '../../src/features/menus/service.js';
import { scheduledFeature } from '../../src/features/scheduled/index.js';

const ids = { actor:'123456789012345678', bot:'123456789012345679', target:'123456789012345680', role:'123456789012345681', channel:'123456789012345682', otherChannel:'123456789012345683', guild:'123456789012345684' };
interface Body { content?:string; components?:readonly unknown[]; embeds?:readonly unknown[]; files?:readonly unknown[]; flags?:number; [key:string]:unknown }
interface Call { sql:string; values:readonly unknown[] }
interface Result { rows:Record<string,unknown>[]; rowCount:number }
function body(value:unknown):Body { return typeof value==='string' ? {content:value} : value as Body; }
function json(value:unknown):unknown { return value && typeof value==='object' && 'toJSON' in value && typeof value.toJSON==='function' ? value.toJSON() : value; }
function buttons(value:Body):string[] {
  return (value.components ?? []).flatMap(row => {
    const data=json(row) as {components:{custom_id?:string}[]};
    return data.components.map(component=>component.custom_id ?? '');
  });
}

function fixture(definition:FeatureDefinition, initial:Record<string,Record<string,unknown>[]>={}) {
  const events:string[]=[];
  const calls:Call[]=[];
  const replies:Body[]=[];
  const posted:ReturnType<typeof message>[]=[];
  const rows:Record<string,Record<string,unknown>[]>={...initial};
  const control={ failSql:undefined as RegExp|undefined, failEffect:'', confirmations:[] as boolean[], timeout:false, onConfirm:undefined as (()=>void)|undefined, memberPosition:2, replyEphemeral:false, zeroCountdownUpdate:false, grantCooldown:false };
  let nextMessage=0;
  let currentReply:ReturnType<typeof message>|undefined;
  const user={id:ids.actor,tag:'actor#0001',username:'Actor',bot:false,displayAvatarURL:()=> 'https://cdn.discordapp.com/avatar.png',send:async(value:unknown)=>{effect('dm');return message(body(value));}};
  const effect=(name:string):void=>{events.push(`effect:${name}`);if(control.failEffect===name)throw new Error(`Discord ${name} failed`);};
  const all=()=>new PermissionsBitField(PermissionFlagsBits.Administrator);
  const actor={id:ids.actor,user,displayName:'Actor',permissions:all(),roles:{highest:{position:10,comparePositionTo:(role:{position:number})=>10-role.position}},permissionsIn:(target:unknown)=>channelPermission(actor.id,target)};
  const bot={id:ids.bot,user:{...user,id:ids.bot,bot:true},permissions:all(),roles:{highest:{position:20,comparePositionTo:(role:{position:number})=>20-role.position}},permissionsIn:(target:unknown)=>channelPermission(bot.id,target)};
  const target={id:ids.target,user:{...user,id:ids.target},displayName:'Target',permissions:new PermissionsBitField(),roles:{highest:{get position(){return control.memberPosition;}},cache:new Collection<string,{id:string}>([[ids.role,{id:ids.role}]]),
    add:async(role:unknown)=>{effect('role.add');target.roles.cache.set(roleId(role),{id:roleId(role)});},remove:async(role:unknown)=>{effect('role.remove');target.roles.cache.delete(roleId(role));}},permissionsIn:()=>new PermissionsBitField()};
  const roleId=(value:unknown):string=>typeof value==='string'?value:(value as {id:string}).id;
  const role={id:ids.role,name:'Member',position:2,rawPosition:2,managed:false,permissions:new PermissionsBitField(),guild:undefined as unknown};
  const channels=new Map<string,ReturnType<typeof channel>>();
  const channelPermission=(memberId:string,value:unknown):PermissionsBitField=>{
    const selected=channels.get(typeof value==='string'?value:(value as {id:string}).id);
    if(memberId===actor.id)return selected?.denyActor ? new PermissionsBitField() : actor.permissions;
    return selected?.denyBot ? new PermissionsBitField() : bot.permissions;
  };
  const guild={id:ids.guild,name:'Test guild',ownerId:'123456789012345685',members:{me:bot,fetch:async(value:unknown)=>{
    const id=typeof value==='string'?value:(value as {user:string}).user;
    if(id===actor.id)return actor;if(id===bot.id)return bot;if(id===target.id)return target;throw new Error('Unknown guild member');
  },fetchMe:async()=>bot},roles:{fetch:async(id:string)=>id===ids.role?role:null},channels:{cache:new Collection<string,unknown>(),fetch:async(id?:string):Promise<unknown>=>id?channels.get(id) ?? null:new Collection([...channels])}};
  Object.assign(actor,{guild});Object.assign(bot,{guild});Object.assign(target,{guild});role.guild=guild;

  function thread(id:string,createdTimestamp=1){return {id,createdTimestamp,members:{add:async()=>{effect('thread.member');}},send:async(value:unknown)=>{effect('thread.send');return message(body(value));},setArchived:async()=>{effect(`thread.archive:${id}`);},delete:async()=>{effect(`thread.delete:${id}`);},setRateLimitPerUser:async(value:number)=>{effect(`thread.slowmode:${value}`);}};}
  const oldest=thread('oldest',1),newest=thread('newest',2),privateArchived=thread('private-archived',0);
  function channel(id:string,name='general') {
    const value={id,name,type:ChannelType.GuildText,guild,denyActor:false,denyBot:false,parentId:null as string|null,permissionsLocked:false,
      isDMBased:()=>false,isTextBased:()=>true,isSendable:()=>true,isThread:()=>false,
      permissionsFor:(member:{id:string})=>channelPermission(member.id,id),
      fetch:async()=>value,
      send:async(input:unknown)=>{effect('channel.send');const sent=message(body(input));posted.push(sent);return sent;},
      setRateLimitPerUser:async(seconds:number)=>{effect(`channel.slowmode:${seconds}`);},
      messages:{fetch:async(messageId:string):Promise<unknown>=>posted.find(item=>item.id===messageId) ?? currentReply!,delete:async()=>{effect('menu.message.delete');}},
      threads:{fetchActive:async()=>({threads:new Collection([[oldest.id,oldest],[newest.id,newest]])}),fetchArchived:async(options:{type:string})=>({threads:options.type==='private'?new Collection([[privateArchived.id,privateArchived]]):new Collection()}),create:async()=>{effect('thread.create');return thread('private-ticket');}},
      permissionOverwrites:{cache:new Collection<string,{id:string;type:number;allow:PermissionsBitField;deny:PermissionsBitField;delete:()=>Promise<void>}>(),edit:async(id:unknown,permissions:Record<string,boolean|null>)=>{
        effect('overwrite.edit');const key=roleId(id);const previous=value.permissionOverwrites.cache.get(key);
        const allow=new PermissionsBitField(previous?.allow.bitfield ?? 0n),deny=new PermissionsBitField(previous?.deny.bitfield ?? 0n);
        for(const [name,state] of Object.entries(permissions)) {
          const bit=PermissionFlagsBits[name as keyof typeof PermissionFlagsBits];allow.remove(bit);deny.remove(bit);if(state===true)allow.add(bit);else if(state===false)deny.add(bit);
        }
        value.permissionOverwrites.cache.set(key,{id:key,type:1,allow,deny,delete:async()=>{effect('overwrite.delete');value.permissionOverwrites.cache.delete(key);}});
      }},
    };
    channels.set(id,value);guild.channels.cache.set(id,value);return value;
  }
  const primary=channel(ids.channel),other=channel(ids.otherChannel,'private');
  function message(input:Body={},ephemeral=false) {
    let value=input;
    const result={id:String(223456789012345678n+BigInt(++nextMessage)),channelId:primary.id,guild,channel:primary,client:{user:bot.user},author:user,member:actor,content:input.content ?? '',createdTimestamp:Date.now(),embeds:[],components:[],hasThread:false,interactionMetadata:undefined,
      get value(){return value;},get url(){return `https://discord.com/channels/${guild.id}/${primary.id}/${result.id}`;},
      reactions:{cache:new Collection<string,{emoji:{id:null;name:string};users:{fetch:()=>Promise<Collection<string,{id:string;bot:boolean}>>}}> ()},
      edit:async(input:unknown)=>{if(ephemeral)throw new Error('Ephemeral message must use its webhook');effect('message.edit');value=body(input);replies.push(value);return result;},
      delete:async()=>{effect('message.delete');},
      react:async(emoji:string)=>{if(ephemeral)throw new Error('Ephemeral messages cannot have reactions');effect(`react:${emoji}`);result.reactions.cache.set(emoji,{emoji:{id:null,name:emoji},users:{fetch:async()=>new Collection([[target.id,{id:target.id,bot:false}],[bot.id,{id:bot.id,bot:true}]])}});},
      reply:async(input:unknown)=>{effect('job.announce');const sent=message(body(input));posted.push(sent);return sent;},
      startThread:async()=>{effect('thread.start');return thread('public-ticket');},
      awaitMessageComponent:async(options:{filter:(candidate:unknown)=>boolean;time:number})=>{
        assert.equal(options.time,30000);if(control.timeout)throw new Error('Confirmation timed out');
        const ids=buttons(value);const approved=control.confirmations.shift() ?? true;
        const chosen=ids[approved?0:1]!;
        const candidate={user:{id:user.id},message:{id:result.id},customId:chosen};
        assert.equal(options.filter({...candidate,user:{id:'another-user'}}),false);
        assert.equal(options.filter({...candidate,customId:'wrong-action'}),false);
        assert.equal(options.filter(candidate),true);
        return {...candidate,update:async(input:unknown)=>{value=body(input);replies.push(value);control.onConfirm?.();},deferUpdate:async()=>{events.push('button.deferUpdate');control.onConfirm?.();}};
      },
    };return result;
  }
  const query=async(sql:string,values:readonly unknown[]=[]):Promise<Result>=>{
    calls.push({sql,values});events.push(`db:${sql.trim().split(/\s+/u).slice(0,3).join(' ')}`);
    if(control.failSql?.test(sql))throw new Error('Database offline');
    if(sql.includes('INSERT INTO superslow_users'))return control.grantCooldown?{rows:[{user_id:values[1]}],rowCount:1}:{rows:[],rowCount:0};
    if(sql.includes('INSERT INTO scheduled_jobs'))return {rows:[{id:`job-${calls.length}`}],rowCount:1};
    if(sql.includes('INSERT INTO moderation_operations'))rows.moderation_operations=[{id:values[0],kind:values[1],guild_id:values[2],channel_id:values[3],target_id:values[4],role_id:values[5],permission:values[6],previous_state:values[7],applied_state:values[8],actor_id:values[9],message_id:values[10],restore_at:values[11],status:'intent'}];
    if(sql.includes("UPDATE moderation_operations SET status='applied'"))rows.moderation_operations![0]!.status='applied';
    if(sql.includes('UPDATE moderation_operations SET status=$2'))rows.moderation_operations![0]!.status=values[1];
    if(sql.includes('UPDATE moderation_operations SET status=CASE'))rows.moderation_operations![0]!.status=rows.moderation_operations![0]!.restore_at?'intent':'failed';
    if(sql.includes('INSERT INTO countdowns'))rows.countdowns=[{id:values[0],guild_id:values[1],channel_id:values[2],message_id:values[3],user_id:values[4],message:values[5],end_at:values[6],status:'pending_confirmation',confirmation_expires_at:values[7],completed_at:null,outcome_message_id:null}];
    if(sql.includes('INSERT INTO polls'))rows.polls=[{id:values[0],guild_id:values[1],channel_id:values[2],message_id:values[3],user_id:values[4],question:values[5],options:JSON.parse(String(values[6])) as unknown,end_at:values[7],completed_at:null,outcome:null,outcome_message_id:null}];
    if(sql.includes('INSERT INTO giveaways'))rows.giveaways=[{id:values[0],guild_id:values[1],channel_id:values[2],message_id:values[3],user_id:values[4],winner_count:values[5],reaction:values[6],end_at:values[7],completed_at:null,winner_ids:null,outcome_message_id:null}];
    if(sql.includes('UPDATE countdowns SET status=$2')) {
      const record=rows.countdowns?.[0];if(!record || control.zeroCountdownUpdate || record.status!=='pending_confirmation' || (record.confirmation_expires_at as Date).getTime()<=Date.now() || (record.end_at as Date).getTime()<=Date.now())return {rows:[],rowCount:0};record.status=values[1];if(values[1]==='cancelled')record.completed_at=new Date();return {rows:[record],rowCount:1};
    }
    if(sql.includes('UPDATE giveaways SET winner_ids'))rows.giveaways![0]!.winner_ids=JSON.parse(String(values[1])) as unknown;
    if(sql.includes('UPDATE polls SET outcome='))rows.polls![0]!.outcome=JSON.parse(String(values[1])) as unknown;
    const finished=/UPDATE (giveaways|polls|countdowns) SET completed_at=/u.exec(sql)?.[1];
    if(finished && rows[finished]?.[0]) {rows[finished]![0]!.completed_at=new Date();rows[finished]![0]!.outcome_message_id=values[1] ?? null;rows[finished]![0]!.terminal_reason=values[2] ?? null;}
    if(sql.includes("UPDATE countdowns SET status='cancelled'")){const record=rows.countdowns?.[0];if(record && record.status==='pending_confirmation' && (record.confirmation_expires_at as Date).getTime()<=Date.now())record.status='cancelled';}
    if(sql.trim().startsWith('SELECT')) {
      const table=/FROM (\w+)/u.exec(sql)?.[1];let result=table ? rows[table] ?? []:[];
      if(table==='moderation_operations' && sql.includes('SELECT id FROM'))result=result.filter(row=>row.status==='intent' || (row.status==='applied' && row.restore_at!==null));
      if(table==='countdowns' && sql.includes("status='cancelled'"))result=result.filter(row=>row.status==='cancelled' && row.completed_at===null && (row.confirmation_expires_at as Date).getTime()<=Date.now());
      return {rows:result,rowCount:result.length};
    }
    return {rows:[],rowCount:0};
  };
  const connection={query,release:()=>events.push('db:RELEASE')};
  const pool={query,connect:async()=>connection} as unknown as Pool;
  const services={pool,client:{user:bot.user,emojis:{cache:new Collection()},channels:{fetch:async(id:string)=>channels.get(id)},guilds:{fetch:async()=>guild}},ownerIds:new Set(),prefixes:new Map(),startedAt:Date.now(),env:{},logger:{error:()=>events.push('log:error'),info:()=>{}}} as unknown as RuntimeServices;
  const runtime=definition.create(services);
  function interaction(subcommand:string, options:Record<string,unknown>={}) {
    const response=(input:unknown)=>{const data=body(input);replies.push(data);if(!currentReply)currentReply=message(data,control.replyEphemeral);else Object.assign(currentReply.value,data);return currentReply;};
    const invocation={id:'323456789012345678',channelId:primary.id,guildId:guild.id,guild,channel:primary,client:services.client,user,
      replied:false,deferred:false,get memberPermissions(){return actor.permissionsIn(primary);},get appPermissions(){return bot.permissionsIn(primary);},
      inGuild:()=>true,isButton:()=>false,
      options:{getSubcommand:()=>subcommand,getString:(name:string)=>typeof options[name]==='string'?options[name]:null,getInteger:(name:string)=>typeof options[name]==='number'?options[name]:null,getBoolean:(name:string)=>typeof options[name]==='boolean'?options[name]:null,getUser:(name:string)=>options[name] ?? null,getRole:(name:string)=>options[name] ?? null,getChannel:(name:string)=>options[name] ?? null},
      reply:async(input:unknown)=>{invocation.replied=true;return response(input);},deferReply:async(input?:{flags?:number})=>{invocation.deferred=true;control.replyEphemeral=Boolean((input?.flags ?? 0)&MessageFlags.Ephemeral);},fetchReply:async()=>{currentReply ??=message({},control.replyEphemeral);return currentReply;},editReply:async(input:unknown)=>response(input),followUp:async(input:unknown)=>{const sent=message(body(input),Boolean((body(input).flags ?? 0)&MessageFlags.Ephemeral));replies.push(body(input));return sent;},
      webhook:{editMessage:async(id:string,input:unknown)=>{assert.equal(id,currentReply?.id);events.push('webhook.edit');return response(input);}},
    };return invocation as unknown as ChatInputCommandInteraction;
  }
  async function execute(name:string,subcommand='',options:Record<string,unknown>={}) {
    const command=runtime.slashCommands?.find(command=>command.data.name===name);assert.ok(command,`Missing native /${name}`);await command.execute(interaction(subcommand,options));
  }
  function button(customId:string,userId=user.id,messageId=currentReply!.id):Interaction {
    return {customId,user:{...user,id:userId},message:{id:messageId},memberPermissions:actor.permissions, isButton:()=>true,reply:async(input:unknown)=>{replies.push(body(input));},deferUpdate:async()=>{events.push('button.deferUpdate');},editReply:async(input:unknown)=>{replies.push(body(input));}} as unknown as Interaction;
  }
  function deny(permissions:PermissionResolvable=0n){actor.permissions=new PermissionsBitField(permissions);}
  return {runtime,services,rows,events,calls,replies,posted,control,user,actor,bot,target,role,primary,other,oldest,newest,privateArchived,execute,interaction,button,deny,message,
    content:()=>replies.map(reply=>reply.content ?? '').join('\n'),
    writes:(table:string)=>calls.filter(call=>call.sql.includes(`INSERT INTO ${table}`)),
    jobTypes:()=>calls.filter(call=>call.sql.includes('INSERT INTO scheduled_jobs')).map(call=>call.values[0]),
    effectCount:(name:string)=>events.filter(event=>event===`effect:${name}`).length,
    reply:()=>currentReply!,
  };
}

test('native /ticketing on stores the reviewed private settings and off removes them',async()=>{
  const f=fixture(automationFeature);
  await f.execute('ticketing','on',{visibility:'private',archiving:'1d',slowmode:'1m'});
  assert.deepEqual(f.writes('ticket_settings')[0]?.values,[ids.channel,ids.guild,false,60,1440]);
  assert.equal(f.effectCount('channel.send'),1);
  assert.match(f.content(),/Ticketing enabled/);
  await f.execute('ticketing','list');assert.match(f.content(),/private, archive 1440 minutes/);
  await f.execute('ticketing','off');assert.ok(f.calls.some(call=>call.sql.includes('DELETE FROM ticket_settings')));
  assert.match(f.content(),/Ticketing disabled/);
});
test('native /ticketing cancellation, revoked permissions, and database failure create no configuration',async()=>{
  for(const scenario of ['cancel','revoked','database'] as const){
    const f=fixture(automationFeature);f.control.confirmations=[scenario!=='cancel'];
    if(scenario==='revoked')f.control.onConfirm=()=>f.deny();
    if(scenario==='database')f.control.failSql=/INSERT INTO ticket_settings/u;
    const call=f.execute('ticketing','on',{visibility:'public',archiving:'1h'});
    if(scenario==='database')await assert.rejects(call,/Database operation failed/);else await call;
    assert.equal(f.effectCount('channel.send'),0);
    if(scenario!=='database')assert.equal(f.writes('ticket_settings').length,0);
  }
});

test('native /ticket creates private membership without posting the ticket body publicly',async()=>{
  const f=fixture(automationFeature,{ticket_settings:[{channel_id:ids.channel,guild_id:ids.guild,are_public:false,slowmode_seconds:30,archive_minutes:1440}]});
  await f.runtime.hydrate!();
  await f.execute('ticket','',{title:'Private support question',description:'Sensitive support details'});
  assert.equal(f.effectCount('thread.create'),1);assert.equal(f.effectCount('thread.member'),1);assert.equal(f.effectCount('thread.send'),1);
  assert.equal(f.effectCount('channel.send'),0);assert.equal(f.effectCount('thread.slowmode:30'),1);
  assert.match(f.content(),/Created your ticket/);
});
test('native /ticket creates a public starter and removes an incomplete starter when thread creation fails',async()=>{
  for(const failure of [false,true]) {
    const f=fixture(automationFeature,{ticket_settings:[{channel_id:ids.channel,guild_id:ids.guild,are_public:true,slowmode_seconds:0,archive_minutes:60}]});
    await f.runtime.hydrate!();if(failure)f.control.failEffect='thread.start';
    const call=f.execute('ticket','',{title:'Question'});
    if(failure)await assert.rejects(call,/Discord thread.start failed/);else await call;
    assert.equal(f.effectCount('channel.send'),1);assert.equal(f.effectCount('thread.start'),1);
    assert.equal(f.effectCount('message.delete'),failure?1:0);
  }
});
test('native /ticket checks user and private-thread bot permissions before creating any thread',async()=>{
  for(const who of ['user','bot']){
    const f=fixture(automationFeature,{ticket_settings:[{channel_id:ids.channel,guild_id:ids.guild,are_public:false,slowmode_seconds:0,archive_minutes:60}]});
    await f.runtime.hydrate!();if(who==='user')f.deny();else f.bot.permissions=new PermissionsBitField(PermissionFlagsBits.ViewChannel);
    await f.execute('ticket','',{title:'Question'});
    assert.equal(f.effectCount('thread.create'),0);assert.equal(f.effectCount('channel.send'),0);assert.match(f.content(),/lack the required permissions/);
  }
});

test('native /autothreading on uses structured duration/title/bot options and off removes configuration',async()=>{
  const f=fixture(automationFeature);
  await f.execute('autothreading','on',{title:'[member] discussion',archiving:'1d',slowmode:'5s',bots:true});
  assert.deepEqual(f.writes('autothreading_settings')[0]?.values,[ids.channel,ids.guild,'[member] discussion',true,5,1440]);
  await f.execute('autothreading','list');assert.match(f.content(),/bots true/);
  await f.execute('autothreading','off');assert.ok(f.calls.some(call=>call.sql.includes('DELETE FROM autothreading_settings')));
});
test('native /autothreading denies unauthorized mutation and a failed write cannot activate passive threading',async()=>{
  const denied=fixture(automationFeature);denied.deny();await denied.execute('autothreading','on',{title:'Discussion',archiving:'1h',bots:false});
  assert.equal(denied.writes('autothreading_settings').length,0);
  const failed=fixture(automationFeature);failed.control.failSql=/INSERT INTO autothreading_settings/u;
  await assert.rejects(failed.execute('autothreading','on',{title:'Discussion',archiving:'1h',bots:false}),/Database operation failed/);
  const source=failed.message({content:'Hello'});
  assert.equal(await failed.runtime.onMessage!(source as unknown as Message),'continue');assert.equal(failed.effectCount('thread.start'),0);
});

test('native /threads archives oldest active threads and deletes active plus archived private threads after review',async()=>{
  const f=fixture(automationFeature);
  await f.execute('threads','archive',{count:'3',silent:true});
  assert.equal(f.effectCount('thread.archive:oldest'),1);assert.equal(f.effectCount('thread.archive:newest'),1);
  await f.execute('threads','delete',{count:'all',which:'both',silent:true});
  for(const id of ['oldest','newest','private-archived'])assert.equal(f.effectCount(`thread.delete:${id}`),1);
  assert.match(f.content(),/Deleted 3 threads/);
});
test('native /threads permissions revoked during confirmation stop deletion and individual failures are reported',async()=>{
  const revoked=fixture(automationFeature);revoked.control.onConfirm=()=>revoked.deny();
  await revoked.execute('threads','delete',{count:'all',which:'active'});assert.equal(revoked.effectCount('thread.delete:oldest'),0);assert.match(revoked.content(),/permissions changed/);
  const failed=fixture(automationFeature);failed.control.failEffect='thread.archive:oldest';
  await failed.execute('threads','archive',{count:'all'});assert.match(failed.content(),/Archived 1 threads. Failed: 1/);
  const denied=fixture(automationFeature);denied.deny();await denied.execute('threads','archive',{count:'all'});assert.equal(denied.effectCount('thread.archive:oldest'),0);
});

test('native /react maps multiple emojis to the real public probe and persists only after validation',async()=>{
  const f=fixture(automationFeature);
  await f.execute('react','on',{emojis:'👍 ❤️'});
  assert.deepEqual(f.writes('auto_reactions')[0]?.values,[ids.channel,ids.guild,['👍','❤️']]);
  assert.equal(f.control.replyEphemeral,false);assert.equal(f.effectCount('react:👍'),1);assert.equal(f.effectCount('react:❤️'),1);
  const write=f.events.findIndex(event=>event.startsWith('db:INSERT INTO auto_reactions'));
  assert.ok(write>f.events.indexOf('effect:react:❤️'));
  await f.execute('react','status');assert.match(f.content(),/👍 ❤️/);
  await f.execute('react','off');assert.ok(f.calls.some(call=>call.sql.includes('DELETE FROM auto_reactions')));
});
test('native /react rejects unauthorized callers and failed reaction validation never changes stored settings',async()=>{
  const denied=fixture(automationFeature);denied.deny();await denied.execute('react','on',{emojis:'👍'});assert.equal(denied.effectCount('react:👍'),0);
  const failed=fixture(automationFeature);failed.control.failEffect='react:👍';await failed.execute('react','on',{emojis:'👍'});
  assert.equal(failed.writes('auto_reactions').length,0);assert.match(failed.content(),/No configuration changed/);
});

test('native /superslow set maps a spaced duration, updates channel slowmode, and off removes settings',async()=>{
  const f=fixture(automationFeature);
  await f.execute('superslow','set',{duration:'6 hours'});
  assert.deepEqual(f.writes('superslow_settings')[0]?.values,[ids.channel,ids.guild,21600000]);
  assert.equal(f.effectCount('channel.slowmode:10'),1);
  await f.execute('superslow','status');assert.match(f.content(),/6 hours/);
  await f.execute('superslow','off');assert.equal(f.effectCount('channel.slowmode:0'),1);assert.ok(f.calls.some(call=>call.sql.includes('DELETE FROM superslow_settings')));
});
test('native /superslow rejects unauthorized and too-short settings and reports partial Discord slowmode failure',async()=>{
  const denied=fixture(automationFeature);denied.deny();await denied.execute('superslow','set',{duration:'6h'});assert.equal(denied.writes('superslow_settings').length,0);
  const invalid=fixture(automationFeature);await invalid.execute('superslow','set',{duration:'1m'});assert.equal(invalid.writes('superslow_settings').length,0);
  const failed=fixture(automationFeature);failed.control.failEffect='channel.slowmode:10';await failed.execute('superslow','set',{duration:'6h'});
  assert.equal(failed.writes('superslow_settings').length,1);assert.match(failed.content(),/settings saved, but Discord slowmode could not be updated/);
});

test('native /clean handles a selected category and descendants without deleting nonempty overwrites',async()=>{
  const f=fixture(moderationFeature);Object.assign(f.other,{type:ChannelType.GuildCategory});f.primary.parentId=f.other.id;
  await f.other.permissionOverwrites.edit(ids.role,{ViewChannel:null});
  await f.primary.permissionOverwrites.edit(ids.role,{ViewChannel:null});
  await f.primary.permissionOverwrites.edit(ids.target,{SendMessages:true});f.events.length=0;
  await f.execute('clean','',{channel:f.other});
  assert.equal(f.effectCount('overwrite.delete'),2);
  assert.equal(f.primary.permissionOverwrites.cache.get(ids.target)?.allow.has(PermissionFlagsBits.SendMessages),true);
  assert.match(f.content(),/Channels found: 2; cleaned: 2; errors: 0/);
});
test('native /clean target authorization and expired confirmation prevent all changes; API failure is counted',async()=>{
  const denied=fixture(moderationFeature);denied.other.denyActor=true;await denied.execute('clean','',{channel:denied.other});assert.equal(denied.effectCount('overwrite.delete'),0);assert.match(denied.content(),/private/);
  const expired=fixture(moderationFeature);expired.control.timeout=true;await expired.execute('clean');assert.equal(expired.effectCount('overwrite.delete'),0);assert.ok(expired.events.includes('webhook.edit'));assert.match(expired.content(),/Confirmation expired/);
  const failed=fixture(moderationFeature);await failed.primary.permissionOverwrites.edit(ids.role,{ViewChannel:null});failed.control.failEffect='overwrite.delete';
  await failed.execute('clean');assert.match(failed.content(),/cleaned: 0; errors: 1/);
});

test('native /remove persists its durable restoration before the effect, and its bound handler restores exactly once',async()=>{
  const f=fixture(moderationFeature);
  await f.execute('remove','',{member:f.target.user,role:f.role,duration:'1 hour'});
  assert.equal(f.target.roles.cache.has(ids.role),false);
  assert.deepEqual(f.jobTypes(),['role_restore']);
  const record=f.writes('moderation_operations')[0]!.values;
  assert.equal(record[4],ids.target);assert.equal(record[5],ids.role);assert.equal(record[7],'present');assert.equal(record[8],'absent');
  assert.ok(f.events.indexOf('effect:role.remove')>f.events.indexOf('db:COMMIT'));assert.ok(f.events.indexOf('effect:role.remove')>f.events.indexOf('db:RELEASE'));
  const job={id:'job',type:'role_restore',payload:{operationId:record[0]},attempts:1};
  await f.runtime.handlers!.role_restore!(job,new AbortController().signal);
  assert.equal(f.target.roles.cache.has(ids.role),true);assert.equal(f.rows.moderation_operations?.[0]?.status,'restored');
  await f.runtime.handlers!.role_restore!(job,new AbortController().signal);assert.equal(f.effectCount('role.add'),1);
});
test('native /remove rejects user hierarchy and post-confirmation permission loss without a durable mutation',async()=>{
  for(const scenario of ['hierarchy','revoked'] as const){
    const f=fixture(moderationFeature);if(scenario==='hierarchy')f.control.memberPosition=10;else f.control.onConfirm=()=>f.deny();
    await f.execute('remove','',{member:f.target.user,role:f.role,duration:'1h'});
    assert.equal(f.writes('moderation_operations').length,0);assert.equal(f.effectCount('role.remove'),0);assert.equal(f.target.roles.cache.has(ids.role),true);
  }
});
test('native /remove database admission failure leaves Discord unchanged and REST failure retains temporary intent',async()=>{
  const db=fixture(moderationFeature);db.control.failSql=/INSERT INTO moderation_operations/u;
  await db.execute('remove','',{member:db.target.user,role:db.role,duration:'1h'});assert.equal(db.effectCount('role.remove'),0);assert.ok(db.events.includes('db:ROLLBACK'));assert.match(db.content(),/Database operation failed/);
  const rest=fixture(moderationFeature);rest.control.failEffect='role.remove';await rest.execute('remove','',{member:rest.target.user,role:rest.role,duration:'1h'});
  assert.deepEqual(rest.jobTypes(),['role_restore']);assert.equal(rest.rows.moderation_operations?.[0]?.status,'intent');assert.match(rest.content(),/Discord role.remove failed/);
});

test('native /perms info and selected-role report use private replies and expose the requested overwrite',async()=>{
  const f=fixture(moderationFeature);await f.other.permissionOverwrites.edit(ids.role,{SendMessages:false});
  await f.execute('perms','info');assert.match(f.content(),/6\. SendMessages/);assert.equal(f.control.replyEphemeral,true);
  await f.execute('perms','report',{channel:f.other,role:f.role});
  const attachment=f.replies.at(-1)!.files?.[0] as {attachment:Buffer};const text=attachment.attachment.toString('utf8');
  assert.match(text,/#private/);assert.match(text,/SendMessages/);assert.match(text,new RegExp(ids.role));
});
test('native /perms set captures deny/allow/inherit correctly and permission restoration preserves other bits',async()=>{
  for(const state of ['allow','deny','inherit'] as const){
    const f=fixture(moderationFeature);await f.other.permissionOverwrites.edit(ids.target,{ViewChannel:state==='deny'?true:false,SendMessages:true});f.events.length=0;
    await f.execute('perms','set',{permission:'view',state,user:f.target.user,channel:f.other,duration:'1h'});
    assert.equal(f.effectCount('overwrite.edit'),1);assert.deepEqual(f.jobTypes(),['permission_restore']);
    const entry=f.other.permissionOverwrites.cache.get(ids.target)!;
    assert.equal(entry.allow.has(PermissionFlagsBits.ViewChannel),state==='allow');assert.equal(entry.deny.has(PermissionFlagsBits.ViewChannel),state==='deny');
    const record=f.writes('moderation_operations')[0]!.values;
    await f.runtime.handlers!.permission_restore!({id:'restore',type:'permission_restore',payload:{operationId:record[0]},attempts:1},new AbortController().signal);
    assert.equal(entry.allow.has(PermissionFlagsBits.SendMessages),true);
    const restored=f.other.permissionOverwrites.cache.get(ids.target)!;
    assert.equal(restored.allow.has(PermissionFlagsBits.ViewChannel),state==='deny');assert.equal(restored.deny.has(PermissionFlagsBits.ViewChannel),state!=='deny');assert.equal(restored.allow.has(PermissionFlagsBits.SendMessages),true);
  }
});
test('native /perms set rejects selected-channel denial and reports a database failure without editing Discord',async()=>{
  const denied=fixture(moderationFeature);denied.other.denyActor=true;await denied.execute('perms','set',{permission:'view',state:'deny',user:denied.target.user,channel:denied.other});assert.equal(denied.effectCount('overwrite.edit'),0);assert.match(denied.content(),/private/);
  const failed=fixture(moderationFeature);failed.control.failSql=/INSERT INTO moderation_operations/u;await failed.execute('perms','set',{permission:'view',state:'deny',user:failed.target.user,duration:'1h'});
  assert.equal(failed.effectCount('overwrite.edit'),0);assert.match(failed.content(),/0 succeeded, 1 failed/);
});
test('moderation restoration cancellation and lost bot permissions cannot mutate roles',async()=>{
  const f=fixture(moderationFeature);await f.execute('remove','',{member:f.target.user,role:f.role,duration:'1h'});
  const record=f.writes('moderation_operations')[0]!.values;const job={id:'restore',type:'role_restore',payload:{operationId:record[0]},attempts:1};
  const aborted=new AbortController();aborted.abort(new Error('stopping'));await assert.rejects(f.runtime.handlers!.role_restore!(job,aborted.signal),/stopping/);
  f.bot.permissions=new PermissionsBitField();await assert.rejects(f.runtime.handlers!.role_restore!(job,new AbortController().signal),/blocked by hierarchy or permissions/);
  assert.equal(f.effectCount('role.add'),0);assert.equal(f.rows.moderation_operations?.[0]?.status,'applied');
});

test('native /poll persists the selected question/options/deadline before adding voting reactions',async()=>{
  const f=fixture(scheduledFeature);await f.execute('poll','',{question:'Choose the next feature',timeout:'1 hour',one:'Option A',two:'Option B'});
  const saved=f.writes('polls')[0]!.values;assert.equal(saved[5],'Choose the next feature');assert.deepEqual(JSON.parse(String(saved[6])),['Option A','Option B']);assert.ok(saved[7] instanceof Date);
  assert.deepEqual(f.jobTypes(),['poll.complete']);assert.equal(f.control.replyEphemeral,false);
  assert.ok(f.events.indexOf('effect:react:1️⃣')>f.events.indexOf('db:COMMIT'));assert.ok(f.events.indexOf('effect:react:1️⃣')>f.events.indexOf('db:RELEASE'));
});
test('native /poll supports no deadline, rejects missing bot permissions, and retains no active poll after reaction failure',async()=>{
  const permanent=fixture(scheduledFeature);await permanent.execute('poll','',{question:'Question',timeout:'0',one:'A',two:'B'});assert.equal(permanent.writes('polls')[0]!.values[7],null);assert.deepEqual(permanent.jobTypes(),[]);
  const denied=fixture(scheduledFeature);denied.bot.permissions=new PermissionsBitField();await denied.execute('poll','',{question:'Question',timeout:'1h',one:'A',two:'B'});assert.equal(denied.writes('polls').length,0);assert.match(denied.content(),/add reactions and read message history/);
  const failed=fixture(scheduledFeature);failed.control.failEffect='react:2️⃣';await assert.rejects(failed.execute('poll','',{question:'Question',timeout:'1h',one:'A',two:'B'}),/Discord react/);
  assert.ok(failed.rows.polls?.[0]?.completed_at instanceof Date);assert.match(failed.content(),/Poll cancelled/);
});
test('poll completion uses persisted votes and announces once; cancellation before polling performs no Discord effect',async()=>{
  const f=fixture(scheduledFeature);await f.execute('poll','',{question:'Question',timeout:'1h',one:'A',two:'B'});
  const id=String(f.rows.polls![0]!.id);const job={id:'poll-job',type:'poll.complete',payload:{id},attempts:1};
  const aborted=new AbortController();aborted.abort(new Error('stopping'));await assert.rejects(f.runtime.handlers!['poll.complete']!(job,aborted.signal),/stopping/);assert.equal(f.effectCount('job.announce'),0);
  await f.runtime.handlers!['poll.complete']!(job,new AbortController().signal);
  assert.deepEqual(f.rows.polls![0]!.outcome,[{label:'A',votes:1},{label:'B',votes:1}]);assert.equal(f.effectCount('job.announce'),1);
  assert.equal(f.posted[0]?.value.enforceNonce,true);assert.ok(f.rows.polls![0]!.completed_at instanceof Date);
  await f.runtime.handlers!['poll.complete']!(job,new AbortController().signal);assert.equal(f.effectCount('job.announce'),1);
});
test('poll deadline admission failure does not create reactions or a durable job',async()=>{
  const f=fixture(scheduledFeature);f.control.failSql=/INSERT INTO polls/u;
  await assert.rejects(f.execute('poll','',{question:'Question',timeout:'1h',one:'A',two:'B'}),/Database operation failed/);
  assert.equal(f.effectCount('react:1️⃣'),0);assert.deepEqual(f.jobTypes(),[]);assert.ok(f.events.includes('db:ROLLBACK'));
});

test('native /giveaway and completion preserve requested winners/reaction and ignore bot entrants',async()=>{
  const f=fixture(scheduledFeature);await f.execute('giveaway','',{winners:2,duration:'1 hour',emoji:'✅'});
  const record=f.rows.giveaways![0]!;assert.equal(record.winner_count,2);assert.equal(record.reaction,'✅');assert.deepEqual(f.jobTypes(),['giveaway.complete']);assert.equal(f.control.replyEphemeral,false);
  assert.ok(f.events.indexOf('effect:react:✅')>f.events.indexOf('db:COMMIT'));
  const job={id:'giveaway-job',type:'giveaway.complete',payload:{id:record.id},attempts:1};
  await f.runtime.handlers!['giveaway.complete']!(job,new AbortController().signal);
  assert.deepEqual(record.winner_ids,[ids.target]);assert.equal(f.effectCount('job.announce'),1);
  const mentions=f.posted[0]?.value.allowedMentions as {users:string[]};assert.deepEqual(mentions.users,[ids.actor]);
  await f.runtime.handlers!['giveaway.complete']!(job,new AbortController().signal);assert.equal(f.effectCount('job.announce'),1);
});
test('native /giveaway authorization and reaction/database failures cannot leave a running giveaway',async()=>{
  const denied=fixture(scheduledFeature);denied.deny();await denied.execute('giveaway','',{winners:1,duration:'1h',emoji:'✅'});assert.equal(denied.writes('giveaways').length,0);
  const rest=fixture(scheduledFeature);rest.control.failEffect='react:✅';await assert.rejects(rest.execute('giveaway','',{winners:1,duration:'1h',emoji:'✅'}),/Discord react/);assert.ok(rest.rows.giveaways![0]!.completed_at instanceof Date);assert.match(rest.content(),/Giveaway cancelled/);
  const db=fixture(scheduledFeature);db.control.failSql=/INSERT INTO giveaways/u;await assert.rejects(db.execute('giveaway','',{winners:1,duration:'1h',emoji:'✅'}),/Database operation failed/);assert.equal(db.effectCount('react:✅'),0);assert.deepEqual(db.jobTypes(),[]);
});
test('giveaway retry after announcement failure retains the original winners instead of drawing again',async()=>{
  const f=fixture(scheduledFeature);await f.execute('giveaway','',{winners:1,duration:'1h',emoji:'✅'});
  const record=f.rows.giveaways![0]!;const job={id:'giveaway-job',type:'giveaway.complete',payload:{id:record.id},attempts:1};
  f.control.failEffect='job.announce';await assert.rejects(f.runtime.handlers!['giveaway.complete']!(job,new AbortController().signal),/Discord job.announce/);
  assert.deepEqual(record.winner_ids,[ids.target]);assert.equal(record.completed_at,null);
  // Votes may change between attempts; the already persisted draw remains authoritative.
  f.reply().reactions.cache.clear();f.control.failEffect='';
  await f.runtime.handlers!['giveaway.complete']!({...job,attempts:2},new AbortController().signal);
  assert.deepEqual(record.winner_ids,[ids.target]);assert.ok(f.rows.giveaways![0]!.completed_at instanceof Date);
});

test('native /countdown stores a bound confirmation; accept schedules and completion announces the selected message once',async()=>{
  const f=fixture(scheduledFeature);await f.execute('countdown','',{epoch:Math.floor(Date.now()/1000)+3600,message:'Deploy review is complete'});
  const record=f.rows.countdowns![0]!;assert.equal(record.message,'Deploy review is complete');assert.equal(record.status,'pending_confirmation');assert.deepEqual(f.jobTypes(),['countdown.expire']);
  assert.equal(await f.runtime.onInteraction!(f.button(`countdown:${record.id}:yes`)),true);
  assert.equal(record.status,'scheduled');assert.deepEqual(f.jobTypes(),['countdown.expire','countdown.complete']);assert.match(f.content(),/Countdown started/);
  const job={id:'countdown-job',type:'countdown.complete',payload:{id:record.id},attempts:1};
  await f.runtime.handlers!['countdown.complete']!(job,new AbortController().signal);assert.equal(f.effectCount('job.announce'),1);
  const embed=json(f.posted[0]?.value.embeds?.[0]) as {description:string};assert.equal(embed.description,'Deploy review is complete');
  await f.runtime.handlers!['countdown.complete']!(job,new AbortController().signal);assert.equal(f.effectCount('job.announce'),1);
});
test('countdown interaction rejects different users/messages, expired confirmations, and revoked permissions',async()=>{
  for(const scenario of ['user','message','expired','permission'] as const){
    const f=fixture(scheduledFeature);await f.execute('countdown','',{epoch:Math.floor(Date.now()/1000)+3600,message:'Complete'});
    const record=f.rows.countdowns![0]!;if(scenario==='expired')record.confirmation_expires_at=new Date(0);if(scenario==='permission')f.deny();
    await f.runtime.onInteraction!(f.button(`countdown:${record.id}:yes`,scenario==='user'?ids.target:ids.actor,scenario==='message'?'wrong-source':f.reply().id));
    assert.equal(record.status,'pending_confirmation');assert.deepEqual(f.jobTypes(),['countdown.expire']);assert.match(f.content(),/confirmation belongs to someone else/);
  }
});
test('countdown cancel and a confirmation expiry race enqueue no completion job',async()=>{
  for(const accepted of [false,true]){
    const f=fixture(scheduledFeature);await f.execute('countdown','',{epoch:Math.floor(Date.now()/1000)+3600,message:'Complete'});f.control.zeroCountdownUpdate=accepted;
    const record=f.rows.countdowns![0]!;await f.runtime.onInteraction!(f.button(`countdown:${record.id}:${accepted?'yes':'no'}`));
    assert.equal(record.status,accepted?'pending_confirmation':'cancelled');assert.deepEqual(f.jobTypes(),['countdown.expire']);assert.match(f.content(),accepted?/confirmation has expired/:/Countdown cancelled/);
  }
});
test('countdown expiry removes the original buttons durably and completion cancellation performs no announcement',async()=>{
  const f=fixture(scheduledFeature);await f.execute('countdown','',{epoch:Math.floor(Date.now()/1000)+3600,message:'Complete'});
  const record=f.rows.countdowns![0]!;record.confirmation_expires_at=new Date(0);
  await f.runtime.handlers!['countdown.expire']!({id:'expire',type:'countdown.expire',payload:{id:record.id},attempts:1},new AbortController().signal);
  assert.equal(record.status,'cancelled');assert.ok(record.completed_at instanceof Date);assert.deepEqual(f.reply().value.components,[]);assert.match(f.content(),/confirmation expired/);
  const completed=f.effectCount('message.edit');await f.runtime.handlers!['countdown.expire']!({id:'expire',type:'countdown.expire',payload:{id:record.id},attempts:2},new AbortController().signal);assert.equal(f.effectCount('message.edit'),completed);
  const running=fixture(scheduledFeature);await running.execute('countdown','',{epoch:Math.floor(Date.now()/1000)+3600,message:'Complete'});const row=running.rows.countdowns![0]!;row.status='scheduled';
  const abort=new AbortController();abort.abort(new Error('stopping'));await assert.rejects(running.runtime.handlers!['countdown.complete']!({id:'complete',type:'countdown.complete',payload:{id:row.id},attempts:1},abort.signal),/stopping/);assert.equal(running.effectCount('job.announce'),0);
});
test('native /countdown requires Manage Messages and database failure leaves no durable confirmation job',async()=>{
  const denied=fixture(scheduledFeature);denied.deny();await denied.execute('countdown','',{epoch:Math.floor(Date.now()/1000)+3600,message:'Complete'});assert.equal(denied.writes('countdowns').length,0);
  const failed=fixture(scheduledFeature);failed.control.failSql=/INSERT INTO countdowns/u;await assert.rejects(failed.execute('countdown','',{epoch:Math.floor(Date.now()/1000)+3600,message:'Complete'}),/Database operation failed/);assert.deepEqual(failed.jobTypes(),[]);assert.ok(failed.events.includes('db:ROLLBACK'));
});

test('native /menu creates a public role menu, privately acknowledges it, and reverts its persisted message',async()=>{
  const f=fixture(menusFeature);await f.execute('menu','role',{role:f.role,duration:'1h'});
  const stored=f.writes('menus')[0]!.values;assert.equal(stored[6],'role');assert.equal(stored[7],ids.role);assert.equal(stored[8],null);assert.ok(stored[9] instanceof Date);
  assert.equal(f.effectCount('channel.send'),1);assert.equal(f.effectCount('react:🎭'),1);assert.equal(f.control.replyEphemeral,true);assert.match(f.content(),/Created the reaction menu/);
  await f.execute('menu','revert',{message:f.posted[0]!.url});assert.equal(f.effectCount('menu.message.delete'),1);assert.ok(f.calls.some(call=>call.sql.includes('DELETE FROM menus')));assert.match(f.content(),/Menu reverted/);
});
test('native /menu permission uses the selected channel and alias; help/list show native usage and stored records',async()=>{
  const stored={message_id:'423456789012345678',guild_id:ids.guild,channel_id:ids.channel,created_by:ids.actor,kind:'role',target_id:ids.role,permission:null,expires_at:null,closing:false};
  const f=fixture(menusFeature,{menus:[stored]});await f.runtime.hydrate!();
  await f.execute('menu','help');assert.match(JSON.stringify(f.replies),/\/menu permission/);
  await f.execute('menu','list');assert.match(JSON.stringify(f.replies),new RegExp(stored.message_id));
  await f.execute('menu','permission',{permission:'view',channel:f.other});
  const record=f.writes('menus')[0]!.values;assert.equal(record[6],'permission');assert.equal(record[7],ids.otherChannel);assert.equal(record[8],'ViewChannel');assert.equal(record[9],null);assert.equal(f.effectCount('react:✅'),1);
});
test('native /menu denies actual destination permissions and confirms elevated grants before posting anything',async()=>{
  const denied=fixture(menusFeature);denied.other.denyActor=true;await denied.execute('menu','permission',{permission:'view',channel:denied.other});assert.equal(denied.effectCount('channel.send'),0);assert.equal(denied.writes('menus').length,0);
  const cancel=fixture(menusFeature);cancel.role.permissions=new PermissionsBitField(PermissionFlagsBits.ManageGuild);cancel.control.confirmations=[false];await cancel.execute('menu','role',{role:cancel.role});assert.equal(cancel.effectCount('channel.send'),0);assert.equal(cancel.writes('menus').length,0);
  const revoked=fixture(menusFeature);revoked.role.permissions=new PermissionsBitField(PermissionFlagsBits.ManageGuild);revoked.control.onConfirm=()=>revoked.deny();await revoked.execute('menu','role',{role:revoked.role});assert.equal(revoked.effectCount('channel.send'),0);assert.match(revoked.content(),/permissions changed/);
});
test('native /menu persistence failure deletes the public placeholder and cannot register a usable menu',async()=>{
  const f=fixture(menusFeature);f.control.failSql=/INSERT INTO menus/u;await f.execute('menu','role',{role:f.role});
  assert.equal(f.effectCount('channel.send'),1);assert.equal(f.effectCount('message.delete'),1);assert.equal(f.effectCount('react:🎭'),0);assert.match(f.content(),/Database operation failed/);
});
test('menu feature reaction/delete adapters bind the saved menu and reject bots, unrelated messages, and wrong emojis',async context=>{
  const menuId='423456789012345678';const stored={message_id:menuId,guild_id:ids.guild,channel_id:ids.channel,created_by:ids.actor,kind:'role',target_id:ids.role,permission:null,expires_at:null,closing:false};
  const f=fixture(menusFeature,{menus:[stored]});await f.runtime.hydrate!();
  const participations:unknown[][]=[];const expirations:string[]=[];
  context.mock.method(MenuService.prototype,'participant',async(...args:unknown[])=>{participations.push(args);});
  context.mock.method(MenuService.prototype,'expire',async(id:string)=>{expirations.push(id);});
  const react=(id:string,name:string)=>({message:{id},emoji:{id:null,name}} as unknown as MessageReaction);
  const reactor={id:ids.target,bot:false} as User;
  await f.runtime.onReaction!(react(menuId,'🎭'),reactor,true);await f.runtime.onReaction!(react(menuId,'🎭'),reactor,false);
  await f.runtime.onReaction!(react(menuId,'❌'),reactor,true);await f.runtime.onReaction!(react('unknown','🎭'),reactor,true);
  await f.runtime.onReaction!(react(menuId,'🎭'),{id:ids.bot,bot:true} as User,true);
  assert.deepEqual(participations,[[menuId,ids.target,true],[menuId,ids.target,false]]);
  await f.runtime.onMessageDelete!({id:menuId} as Message);await f.runtime.onMessageDelete!({id:'unrelated'} as Message);assert.deepEqual(expirations,[menuId]);
});
test('menu feature ready/reconciliation/job adapters preserve identifiers and cancellation signals',async context=>{
  const f=fixture(menusFeature);const observed:unknown[][]=[];
  context.mock.method(MenuService.prototype,'ready',async(...args:unknown[])=>{observed.push(['ready',...args]);});
  context.mock.method(MenuService.prototype,'expire',async(...args:unknown[])=>{observed.push(['expire',...args]);});
  context.mock.method(MenuService.prototype,'runParticipant',async(...args:unknown[])=>{observed.push(['participant',...args]);});
  context.mock.method(MenuService.prototype,'enqueueReconciliation',async()=>{observed.push(['reconcile']);return true;});
  await f.runtime.onReady!();assert.equal(await f.runtime.reconcile!(),true);
  const signal=new AbortController().signal;
  await f.runtime.handlers!['menu.expire']!({id:'job',type:'menu.expire',payload:{messageId:'menu'},attempts:1},signal);
  await f.runtime.handlers!['menu.reconcile']!({id:'job',type:'menu.reconcile',payload:{messageId:'menu'},attempts:1},signal);
  await f.runtime.handlers!['menu.participant']!({id:'job',type:'menu.participant',payload:{messageId:'menu',userId:'user'},attempts:1},signal);
  assert.deepEqual(observed,[['ready'],['reconcile'],['expire','menu',signal],['ready','menu',signal],['participant','menu','user',signal]]);
  await assert.rejects(f.runtime.handlers!['menu.expire']!({id:'job',type:'menu.expire',payload:{},attempts:1},signal),/Invalid menu job payload/);
  await assert.rejects(f.runtime.handlers!['menu.participant']!({id:'job',type:'menu.participant',payload:{messageId:'menu'},attempts:1},signal),/Missing menu participant/);
  await assert.rejects(f.runtime.handlers!['menu.participant']!({id:'job',type:'menu.participant',payload:{messageId:'menu',userId:42},attempts:1},signal),/Invalid menu participant/);
});

test('ticket passive hook still deletes nonmoderator chatter when the notification DM fails and respects missing bot permissions',async()=>{
  for(const botCanDelete of [true,false]){
    const f=fixture(automationFeature,{ticket_settings:[{channel_id:ids.channel,guild_id:ids.guild,are_public:false,slowmode_seconds:0,archive_minutes:60}]});await f.runtime.hydrate!();f.deny();f.control.failEffect='dm';
    if(!botCanDelete)f.bot.permissions=new PermissionsBitField(PermissionFlagsBits.ViewChannel);
    const result=await f.runtime.onMessage!(f.message({content:'Chatter'}) as unknown as Message);
    assert.equal(result,botCanDelete?'deleted':'continue');assert.equal(f.effectCount('message.delete'),botCanDelete?1:0);assert.equal(f.effectCount('dm'),botCanDelete?1:0);
  }
});
test('superslow passive hook admits a new cooldown claim but deletes a subsequent blocked message without extending its timestamp',async()=>{
  const f=fixture(automationFeature,{superslow_settings:[{channel_id:ids.channel,guild_id:ids.guild,duration_ms:21600000}],superslow_users:[{timestamp_ms:String(Date.now())}]});await f.runtime.hydrate!();f.deny();f.control.grantCooldown=true;
  assert.equal(await f.runtime.onMessage!(f.message({content:'First message'}) as unknown as Message),'continue');assert.equal(f.effectCount('message.delete'),0);
  f.control.grantCooldown=false;assert.equal(await f.runtime.onMessage!(f.message({content:'Second message'}) as unknown as Message),'deleted');assert.equal(f.effectCount('dm'),1);assert.equal(f.effectCount('message.delete'),1);
  assert.equal(f.calls.filter(call=>call.sql.includes('INSERT INTO superslow_users')).length,2);assert.equal(f.calls.filter(call=>call.sql.includes('SELECT timestamp_ms')).length,1);
});
test('automatic reaction failure does not suppress a configured automatic thread',async()=>{
  const f=fixture(automationFeature,{auto_reactions:[{channel_id:ids.channel,guild_id:ids.guild,emojis:['👍']}],autothreading_settings:[{channel_id:ids.channel,guild_id:ids.guild,title:'[member] discussion',bot_auto:false,slowmode_seconds:5,archive_minutes:1440}]});await f.runtime.hydrate!();f.control.failEffect='react:👍';
  assert.equal(await f.runtime.onMessage!(f.message({content:'Discuss'}) as unknown as Message),'continue');assert.ok(f.events.includes('log:error'));assert.equal(f.effectCount('thread.start'),1);assert.equal(f.effectCount('thread.slowmode:5'),1);
});
test('moderation ready callback reconciles a pre-start permanent intent without replaying its Discord effect',async()=>{
  const record={id:'existing',kind:'role',guild_id:ids.guild,channel_id:ids.channel,target_id:ids.target,role_id:ids.role,permission:null,previous_state:'present',applied_state:'absent',actor_id:ids.actor,message_id:'old',restore_at:null,status:'intent'};
  const f=fixture(moderationFeature,{moderation_operations:[record]});f.target.roles.cache.delete(ids.role);await f.runtime.onReady!();assert.equal(record.status,'applied');assert.equal(f.effectCount('role.remove'),0);assert.equal(f.effectCount('role.add'),0);
});
test('scheduled completion records a terminal missing resource for giveaway, poll and countdown instead of announcing',async()=>{
  for(const name of ['giveaway','poll','countdown'] as const){
    const f=fixture(scheduledFeature);
    if(name==='giveaway')await f.execute(name,'',{winners:1,duration:'1h',emoji:'✅'});
    if(name==='poll')await f.execute(name,'',{question:'Q',timeout:'1h',one:'A',two:'B'});
    if(name==='countdown')await f.execute(name,'',{epoch:Math.floor(Date.now()/1000)+3600,message:'Complete'});
    const table=name==='giveaway'?'giveaways':name==='poll'?'polls':'countdowns';const record=f.rows[table]![0]!;if(name==='countdown')record.status='scheduled';
    f.services.client.channels.fetch=(async()=>null) as typeof f.services.client.channels.fetch;
    await f.runtime.handlers![`${name}.complete`]!({id:'job',type:`${name}.complete`,payload:{id:record.id},attempts:1},new AbortController().signal);
    assert.ok(record.completed_at instanceof Date);assert.match(String(record.terminal_reason),/deleted or no longer accessible/);assert.equal(f.effectCount('job.announce'),0);
  }
});
