CREATE TABLE IF NOT EXISTS moderation_operations (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('permission', 'role')),
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  role_id TEXT,
  permission TEXT,
  previous_state TEXT NOT NULL CHECK (previous_state IN ('allow','deny','inherit','present','absent')),
  applied_state TEXT NOT NULL CHECK (applied_state IN ('allow','deny','inherit','present','absent','unknown')),
  actor_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  restore_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'intent' CHECK (status IN ('intent','applied','restored','conflict','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CHECK ((kind = 'permission' AND permission IS NOT NULL AND role_id IS NULL) OR (kind = 'role' AND role_id IS NOT NULL AND permission IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS moderation_pending_target ON moderation_operations
  (guild_id, (CASE WHEN kind = 'role' THEN '' ELSE channel_id END), target_id, kind, COALESCE(permission, role_id))
  WHERE status IN ('intent','applied') AND restore_at IS NOT NULL;
