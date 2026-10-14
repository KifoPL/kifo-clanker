CREATE TABLE IF NOT EXISTS auto_reactions (
  channel_id text PRIMARY KEY,
  guild_id text,
  emojis text[] NOT NULL CHECK (cardinality(emojis) BETWEEN 1 AND 20)
);
CREATE TABLE IF NOT EXISTS superslow_settings (
  channel_id text PRIMARY KEY,
  guild_id text,
  duration_ms bigint NOT NULL CHECK (duration_ms BETWEEN 21600000 AND 31557600000)
);
CREATE TABLE IF NOT EXISTS superslow_users (
  channel_id text NOT NULL REFERENCES superslow_settings(channel_id) ON DELETE CASCADE,
  user_id text NOT NULL,
  timestamp_ms bigint NOT NULL,
  PRIMARY KEY(channel_id, user_id)
);
CREATE TABLE IF NOT EXISTS ticket_settings (
  channel_id text PRIMARY KEY,
  guild_id text NOT NULL,
  are_public boolean NOT NULL,
  slowmode_seconds integer NOT NULL DEFAULT 0 CHECK (slowmode_seconds BETWEEN 0 AND 21600),
  archive_minutes integer NOT NULL CHECK (archive_minutes IN (60,1440,4320,10080))
);
CREATE TABLE IF NOT EXISTS autothreading_settings (
  channel_id text PRIMARY KEY,
  guild_id text NOT NULL,
  title text NOT NULL CHECK (length(title) >= 1),
  bot_auto boolean NOT NULL,
  slowmode_seconds integer NOT NULL DEFAULT 0 CHECK (slowmode_seconds BETWEEN 0 AND 21600),
  archive_minutes integer NOT NULL CHECK (archive_minutes IN (60,1440,4320,10080))
);
