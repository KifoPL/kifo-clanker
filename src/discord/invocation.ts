import { MessageFlags, PermissionsBitField, type ChatInputCommandInteraction, type RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { InvocationCommand, SlashCommand } from '../contracts/commands.js';
import type { CommandInvocation } from '../contracts/invocation.js';
import type { RuntimeServices } from '../contracts/features.js';

export async function createInvocation(interaction: ChatInputCommandInteraction, publicReply = false): Promise<CommandInvocation> {
  await interaction.deferReply(publicReply ? {} : { flags: MessageFlags.Ephemeral });
  const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);
  if (!channel?.isTextBased()) throw new Error('This command requires an accessible text channel');
  const member = interaction.guild ? await interaction.guild.members.fetch({ user: interaction.user.id, force: true }) : null;
  let replied = false;
  return {
    id: interaction.id, client: interaction.client, author: interaction.user,
    guild: interaction.guild, guildId: interaction.guildId, member, channel, channelId: channel.id,
    inGuild: () => interaction.guild !== null,
    async editReply(messageId, options) {
      return interaction.webhook.editMessage(messageId, typeof options === 'string' ? { content: options } : options);
    },
    async reply(options) {
      const body = typeof options === 'string' ? { content: options } : options;
      if (!replied) { replied = true; return interaction.editReply(body); }
      return interaction.followUp({ ...body, ...(publicReply ? {} : { flags: MessageFlags.Ephemeral }) });
    },
  };
}

export function invocationCommand(
  data: RESTPostAPIChatInputApplicationCommandsJSONBody,
  command: InvocationCommand,
  args: (interaction: ChatInputCommandInteraction) => readonly string[],
  services: RuntimeServices,
  publicReply = false,
): SlashCommand {
  return {
    data,
    async execute(interaction) {
      if (command.ownerOnly && !services.ownerIds.has(interaction.user.id)) {
        await interaction.reply({ content: 'Only the bot owner can use this command.', flags: MessageFlags.Ephemeral }); return;
      }
      if (command.guildOnly && !interaction.guild) {
        await interaction.reply({ content: 'This command requires a server.', flags: MessageFlags.Ephemeral }); return;
      }
      const invocation = await createInvocation(interaction, publicReply);
      if (command.permissions && !invocation.member?.permissionsIn(invocation.channelId).has(new PermissionsBitField([...command.permissions]))) {
        await invocation.reply('You do not have the required permissions in this channel.'); return;
      }
      await command.execute(invocation, args(interaction));
    },
  };
}
