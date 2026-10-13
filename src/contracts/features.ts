import type { Client, Guild, Interaction, Message, MessageReaction, PartialMessage, PartialMessageReaction, PartialUser, RESTPostAPIApplicationCommandsJSONBody, User } from 'discord.js';
import type { Pool } from 'pg';
import type { ContextCommand, SlashCommand } from './commands.js';
import type { ScheduledHandler } from '../scheduler/index.js';
import type { logger } from '../logger.js';

export interface RuntimeServices {
  client: Client;
  pool: Pool;
  ownerIds: Set<string>;
  applicationCommands?: readonly RESTPostAPIApplicationCommandsJSONBody[];
  logger: typeof logger;
  startedAt: number;
  env: Readonly<NodeJS.ProcessEnv>;
  reload?(): Promise<void>;
}

export interface FeatureRuntime {
  slashCommands?: readonly SlashCommand[];
  contextCommands?: readonly ContextCommand[];
  handlers?: Readonly<Record<string, ScheduledHandler>>;
  hydrate?(): Promise<void>;
  onReady?(): Promise<void>;
  onMessage?(message: Message): Promise<'continue' | 'handled' | 'deleted'>;
  onInteraction?(interaction: Interaction): Promise<boolean>;
  onReaction?(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, added: boolean): Promise<void>;
  onMessageDelete?(message: Message | PartialMessage): Promise<void>;
  onGuild?(guild: Guild, event: 'join' | 'leave' | 'unavailable'): Promise<void>;
  close?(): Promise<void>;
  reconcile?(): Promise<boolean>;
}

export interface FeatureDefinition {
  readonly name: string;
  readonly commandData: readonly RESTPostAPIApplicationCommandsJSONBody[];
  create(services: RuntimeServices): FeatureRuntime;
}
