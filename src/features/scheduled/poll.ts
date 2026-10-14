import { BOT_COLOR } from '../../constants.js';
import { randomUUID } from 'node:crypto';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { enqueueJob, query, withTransaction } from '../../db/index.js';
import { parseDuration, pollOptionNames, pollReactions } from './shared.js';
const builder = new SlashCommandBuilder().setName('poll').setDescription('Create a poll.')
  .addStringOption(option => option.setName('question').setDescription('Ask the question or an opinion.').setRequired(true).setMaxLength(1800))
  .addStringOption(option => option.setName('timeout').setDescription('When to calculate results? Use "0" for no timeout.').setRequired(true).setMaxLength(100));
for (const [index, name] of pollOptionNames.entries()) builder.addStringOption(option => option.setName(name).setDescription(`Option ${index + 1}`).setRequired(index < 2).setMaxLength(150));
export const pollData = builder.toJSON();
export function createPoll(services: RuntimeServices): SlashCommand {
  return { data: pollData, async execute(interaction) {
    if (!interaction.guildId || !interaction.appPermissions?.has([PermissionFlagsBits.AddReactions, PermissionFlagsBits.ReadMessageHistory])) { await interaction.reply({ content: 'Use this in a server where I can add reactions and read message history.', flags: MessageFlags.Ephemeral }); return; }
    const timeout = interaction.options.getString('timeout', true).trim();
    const duration = timeout === '0' ? undefined : parseDuration(timeout, 31557600000);
    if (timeout !== '0' && duration === undefined) { await interaction.reply({ content: 'Set the timeout between 1 minute and 1 year, or use 0.', flags: MessageFlags.Ephemeral }); return; }
    await interaction.deferReply();
    const message = await interaction.fetchReply();
    const options = pollOptionNames.map(name => interaction.options.getString(name)).filter((value): value is string => value !== null);
    const question = interaction.options.getString('question', true);
    const end = duration === undefined ? null : new Date(Date.now() + duration);
    const id = randomUUID();
    await withTransaction(services.pool, async connection => {
      await query(connection, 'INSERT INTO polls(id,guild_id,channel_id,message_id,user_id,question,options,end_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id, interaction.guildId, interaction.channelId, message.id, interaction.user.id, question, JSON.stringify(options), end]);
      if (end) await enqueueJob(connection, 'poll.complete', { id }, end, `poll:${id}`);
    });
    const embed = new EmbedBuilder().setColor(BOT_COLOR).setTitle('React to the option you choose!').setDescription(question)
      .addFields(options.map((option, index) => ({ name: `Option ${pollReactions[index]}:`, value: option })));
    try {
      await interaction.editReply({ content: end ? `Poll ends at <t:${Math.floor(end.getTime() / 1000)}> (<t:${Math.floor(end.getTime() / 1000)}:R>).` : '', embeds: [embed] });
      for (const reaction of pollReactions.slice(0, options.length)) await message.react(reaction);
    }
    catch (error) {
      await query(services.pool, "UPDATE polls SET completed_at=clock_timestamp(),terminal_reason='Poll setup failed' WHERE id=$1", [id]);
      await interaction.editReply({ content: 'Poll cancelled: I could not finish its setup.', embeds: [] })
        .catch(cleanupError => services.logger.error('Poll cancellation message failed', cleanupError));
      throw error;
    }
  } };
}
