import type { Client, Guild, GuildMember, Message, MessageReplyOptions, TextBasedChannel, User } from 'discord.js';

export type InvocationReply = string | Pick<MessageReplyOptions, 'content' | 'embeds' | 'files' | 'components' | 'allowedMentions'>;

// Command input is an interaction; returned Messages are real Discord responses/confirmation prompts.
export interface CommandInvocation {
  id: string;
  client: Client;
  author: User;
  guild: Guild | null;
  guildId: string | null;
  member: GuildMember | null;
  channel: TextBasedChannel;
  channelId: string;
  inGuild(): boolean;
  reply(options: InvocationReply): Promise<Message>;
  editReply(messageId: string, options: InvocationReply): Promise<Message>;
}
