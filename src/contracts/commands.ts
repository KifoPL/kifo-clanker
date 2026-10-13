import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Message, PermissionResolvable, RESTPostAPIChatInputApplicationCommandsJSONBody, RESTPostAPIContextMenuApplicationCommandsJSONBody } from 'discord.js';

export interface SlashCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface PrefixCommand {
  readonly name: string;
  readonly description: string;
  readonly usage?: readonly string[];
  readonly category?: string;
  readonly permissions?: readonly PermissionResolvable[];
  readonly guildOnly?: boolean;
  readonly ownerOnly?: boolean;
  execute(message: Message, args: readonly string[]): Promise<void>;
}

export interface ContextCommand {
  readonly data: RESTPostAPIContextMenuApplicationCommandsJSONBody;
  execute(interaction: ContextMenuCommandInteraction): Promise<void>;
}
