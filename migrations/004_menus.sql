CREATE TABLE IF NOT EXISTS menus (
  message_id text PRIMARY KEY,
  guild_id text NOT NULL,
  channel_id text NOT NULL,
  command_message_id text,
  command_channel_id text,
  created_by text,
  kind text NOT NULL CHECK (kind IN ('role', 'permission')),
  target_id text NOT NULL,
  permission text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  closing boolean NOT NULL DEFAULT false,
  CHECK ((kind = 'role' AND permission IS NULL) OR (kind = 'permission' AND permission IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS menu_participants (
  menu_id text NOT NULL REFERENCES menus(message_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  target_key text NOT NULL UNIQUE,
  previous_state text NOT NULL CHECK (previous_state IN ('allow', 'deny', 'inherit', 'present', 'absent', 'unknown')),
  want_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'capturing' CHECK (status IN ('capturing', 'granting', 'active', 'restoring')),
  PRIMARY KEY (menu_id, user_id)
);
CREATE INDEX IF NOT EXISTS menus_guild_idx ON menus(guild_id, created_at DESC);
