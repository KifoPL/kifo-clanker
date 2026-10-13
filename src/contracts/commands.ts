import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, PermissionResolvable, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPostAPIContextMenuApplicationCommandsJSONBody } from 'discord.js';
import type { CommandInvocation } from './invocation.js';

export interface SlashCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface InvocationCommand {
  readonly name: string;
  readonly description: string;
  readonly usage?: readonly string[];
  readonly category?: string;
  readonly permissions?: readonly PermissionResolvable[];
  readonly guildOnly?: boolean;
  readonly ownerOnly?: boolean;
  execute(invocation: CommandInvocation, args: readonly string[]): Promise<void>;
}

export interface ContextCommand {
  readonly data: RESTPostAPIContextMenuApplicationCommandsJSONBody;
  execute(interaction: ContextMenuCommandInteraction): Promise<void>;
}
