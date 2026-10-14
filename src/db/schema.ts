import type { Pool } from 'pg';
import { DatabaseError, query } from './query.js';
import { readMigrations } from './migrate.js';

export async function assertSchemaReady(pool: Pool): Promise<void> {
  const notReady = 'Database schema is not ready. Run npm run migrate before starting the bot.';
  try {
    const migrations = await readMigrations();
    if (migrations.length < 6) throw new Error(notReady);
    const result = await query<{ version: string; filename: string; checksum: string }>(pool,
      'SELECT version, filename, checksum FROM schema_migrations ORDER BY version');
    if (result.rows.length !== migrations.length || migrations.some((migration) => {
      const applied = result.rows.find((row) => row.version === migration.version);
      return applied?.filename !== migration.name || applied.checksum !== migration.checksum;
    })) throw new Error(notReady);
    await query(pool, 'SELECT guild_id, prefix FROM guild_settings LIMIT 0');
    await query(pool, `SELECT id, type, payload, run_at, attempts, max_attempts, status,
      lease_token, lease_until, last_error, completed_at, created_at, deduplication_key FROM scheduled_jobs LIMIT 0`);
    await query(pool, `SELECT id, kind, guild_id, channel_id, target_id, role_id, permission,
      previous_state, applied_state, actor_id, message_id, restore_at, status, created_at FROM moderation_operations LIMIT 0`);
    await query(pool, `SELECT message_id, guild_id, channel_id, command_message_id, command_channel_id,
      created_by, kind, target_id, permission, expires_at, created_at, closing FROM menus LIMIT 0`);
    await query(pool, `SELECT menu_id, user_id, target_key, previous_state, want_active, status FROM menu_participants LIMIT 0`);
    await query(pool, 'SELECT channel_id, guild_id, emojis FROM auto_reactions LIMIT 0');
    await query(pool, 'SELECT channel_id, guild_id, duration_ms FROM superslow_settings LIMIT 0');
    await query(pool, 'SELECT channel_id, user_id, timestamp_ms FROM superslow_users LIMIT 0');
    await query(pool, 'SELECT channel_id, guild_id, are_public, slowmode_seconds, archive_minutes FROM ticket_settings LIMIT 0');
    await query(pool, 'SELECT channel_id, guild_id, title, bot_auto, slowmode_seconds, archive_minutes FROM autothreading_settings LIMIT 0');
    await query(pool, 'SELECT id, guild_id, channel_id, message_id, user_id, question, options, end_at, outcome, outcome_message_id, completed_at, terminal_reason FROM polls LIMIT 0');
    await query(pool, 'SELECT id, guild_id, channel_id, message_id, user_id, winner_count, reaction, end_at, winner_ids, outcome_message_id, completed_at, terminal_reason FROM giveaways LIMIT 0');
    await query(pool, 'SELECT id, guild_id, channel_id, message_id, user_id, message, end_at, status, confirmation_expires_at, outcome_message_id, completed_at, terminal_reason FROM countdowns LIMIT 0');
    await query(pool, 'SELECT user_id, reported_at FROM error_report_limits LIMIT 0');
  } catch (error) {
    if (error instanceof DatabaseError && ['42P01', '42703'].includes(error.code ?? '')) {
      throw new Error(notReady);
    }
    throw error;
  }
}
