import { PermissionFlagsBits, type GuildChannel } from 'discord.js';
export type PermissionName = keyof typeof PermissionFlagsBits;
export type PermissionState = 'allow' | 'deny' | 'inherit';
const legacy: readonly (readonly [PermissionName, readonly string[]])[] = [
  ['ViewChannel',['view','vch']], ['ManageChannels',['mngc']], ['ManageRoles',['mngr']],
  ['ManageWebhooks',['mngw','webhooks']], ['CreateInstantInvite',['cri','invites','inv']],
  ['SendMessages',['sm','msg','msgs','send']], ['EmbedLinks',['el','embed','links']],
  ['AttachFiles',['af','files']], ['AddReactions',['ar','reactions']],
  ['UseExternalEmojis',['uee','emojis','user_external_emojis']], ['MentionEveryone',['evr','me','every1']],
  ['ManageMessages',['mngm','mmsg']], ['ReadMessageHistory',['rmh','msgh','history']],
  ['SendTTSMessages',['stts','tts','ttsm','msgtts','ttsmsg']], ['Connect',['cnt','con']],
  ['Speak',['spk','say','talk']], ['Stream',['str','vid','video','scr','screen','share']],
  ['UseVAD',['vad','vca','vcad','vact']], ['PrioritySpeaker',['pspk','psay','ptalk']],
  ['MuteMembers',['mm','mute','mtm']], ['DeafenMembers',['dm','deafen','deaf','dfm']],
  ['MoveMembers',['move','mvm','movm']],
];
const normalized = (value: string): string => value.replaceAll('_','').toLowerCase();
export function resolvePermission(value: string): PermissionName | undefined {
  const key = normalized(value);
  const old = legacy.find(([name, aliases], index) => key === String(index + 1) || normalized(name) === key || aliases.some(alias => normalized(alias) === key));
  return old?.[0] ?? (Object.keys(PermissionFlagsBits) as PermissionName[]).find(name => normalized(name) === key);
}
export function permissionAliases(): string {
  return legacy.map(([name, aliases], index) => `${index + 1}. ${name}: ${aliases.join(', ')}`).join('\n');
}
export function permissionState(channel: GuildChannel, targetId: string, permission: PermissionName): PermissionState {
  const overwrite = channel.permissionOverwrites.cache.get(targetId);
  if (overwrite?.allow.has(PermissionFlagsBits[permission])) return 'allow';
  if (overwrite?.deny.has(PermissionFlagsBits[permission])) return 'deny';
  return 'inherit';
}
export function permissionValue(state: PermissionState): boolean | null {
  return state === 'inherit' ? null : state === 'allow';
}
