import { randomUUID } from 'node:crypto';
import ms from 'ms';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type GuildChannel, type GuildMember, type Message } from 'discord.js';
export function snowflake(input: string): string {
  const match = /^(?:([0-9]{17,20})|<[@#]([0-9]{17,20})>|<@(?:!|&)([0-9]{17,20})>)$/.exec(input);
  const id = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!id) throw new Error('Supply a valid Discord ID or mention.');
  return id;
}
export function restorationDate(input: string | undefined, now = Date.now()): Date | undefined {
  if (!input) return undefined;
  if (input.length > 100) throw new Error('Duration is too long.');
  const duration = ms(input as ms.StringValue);
  if (!Number.isFinite(duration) || duration < 60_000 || duration > 100 * 365.25 * 86400000 || !Number.isSafeInteger(now + duration)) throw new Error('Duration must be at least one minute and at most 100 years (for example 10m or 2d).');
  return new Date(now + duration);
}
export async function guildContext(message: Message): Promise<{channel: GuildChannel; actor: GuildMember; bot: GuildMember}> {
  if (!message.guild) throw new Error('Use this command in a server.');
  const channel = await message.guild.channels.fetch(message.channelId,{force:true});
  if (!channel || !('permissionOverwrites' in channel)) throw new Error('This command requires a server channel with permission overwrites.');
  const [actor,bot] = await Promise.all([message.guild.members.fetch({user:message.author.id,force:true}),message.guild.members.fetchMe({force:true})]);
  return {channel,actor,bot};
}
export async function confirm(message: Message, action: string): Promise<boolean> {
  const id = `moderation:${randomUUID()}`;
  const cancelId = `${id}:cancel`;
  const expires = Date.now() + 30_000;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(id).setLabel('Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  const prompt = await message.reply({content:`Confirm: ${action}\nThis confirmation expires in 30 seconds.`,components:[row],allowedMentions:{parse:[]}});
  try {
    const interaction = await prompt.awaitMessageComponent({componentType:ComponentType.Button,time:30_000,filter: value => value.user.id === message.author.id && value.message.id === prompt.id && Date.now() <= expires && (value.customId === id || value.customId === cancelId)});
    await interaction.update({content:interaction.customId === id ? `Confirmed: ${action}` : 'Cancelled.',components:[]});
    return interaction.customId === id;
  } catch {
    await prompt.edit({content:'Confirmation expired.',components:[]});
    return false;
  }
}
export async function commandError(message: Message, error: unknown): Promise<void> {
  await message.reply({content:error instanceof Error ? error.message.slice(0,1800) : 'Command failed.',allowedMentions:{parse:[]}});
}
