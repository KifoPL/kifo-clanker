import { BOT_REPOSITORY, BOT_URLS } from '../../constants.js';
import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { SlashCommand } from '../../contracts/commands.js';
import type { RuntimeServices } from '../../contracts/features.js';
import { query } from '../../db/index.js';
export const errorData = new SlashCommandBuilder().setName('error').setDescription('Report a bot problem as a GitHub issue. Do not spam.')
  .addStringOption(option => option.setName('description').setDescription('Describe how and when the error occurred.').setRequired(true).setMinLength(5).setMaxLength(4000)).toJSON();
export async function createIssue(token: string, repository: string, description: string, context: string, request: typeof fetch = fetch): Promise<string> {
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) throw new Error('Invalid GitHub repository');
  const response = await request(`https://api.github.com/repos/${repository}/issues`, {
    method: 'POST', signal: AbortSignal.timeout(8000), redirect: 'error',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: JSON.stringify({ title: description.slice(0, 80), body: `${context}\n\n## Problem description\n\n${description}`, labels: ['error'] }),
  });
  if (response.status !== 201) throw new Error('GitHub issue creation failed');
  const value: unknown = await response.json();
  if (typeof value !== 'object' || value === null || !('html_url' in value) || typeof value.html_url !== 'string' || !value.html_url.startsWith(`https://github.com/${repository}/issues/`)) throw new Error('Invalid GitHub response');
  return value.html_url;
}
export function createError(services: RuntimeServices): SlashCommand {
  return { data: errorData, async execute(interaction) {
    const token = services.env.GITHUB_TOKEN;
    if (!token) { await interaction.reply({ content: `GitHub reporting is disabled. Report issues at ${BOT_URLS.issues}.`, flags: MessageFlags.Ephemeral }); return; }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const admitted = await query(services.pool, `INSERT INTO error_report_limits(user_id, reported_at) VALUES ($1, clock_timestamp()) ON CONFLICT(user_id) DO UPDATE SET reported_at = EXCLUDED.reported_at WHERE error_report_limits.reported_at <= clock_timestamp() - interval '10 minutes' RETURNING user_id`, [interaction.user.id]);
    if (!admitted.rowCount) { await interaction.editReply({ content: 'Please wait 10 minutes between problem reports.' }); return; }
    try {
      const reply = await interaction.fetchReply();
      const url = await createIssue(token, services.env.GITHUB_REPOSITORY ?? BOT_REPOSITORY, interaction.options.getString('description', true), `Reported by ${interaction.user.tag} (${interaction.user.id}) in ${interaction.guildId ?? 'DM'}/${interaction.channelId}. Discord: ${reply.url}`);
      await interaction.editReply({ content: `Created a GitHub issue: ${url}` });
      await Promise.allSettled([...services.ownerIds].map(async id => { const user = await services.client.users.fetch(id); await user.send({ content: `Bot problem reported by ${interaction.user.tag}: ${url}`, allowedMentions: { parse: [] } }); }));
    } catch { await interaction.editReply({ content: `GitHub reporting failed. Please report the problem at ${BOT_URLS.issues}.` }); }
  } };
}
