import type { ChatInputCommandInteraction, Message, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';

export interface SlashCommand {
  readonly data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

export interface PrefixCommand {
  readonly name: string;
  readonly description: string;
  execute(message: Message, args: readonly string[]): Promise<void>;
}
