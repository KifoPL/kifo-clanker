CREATE TABLE polls (
  id uuid PRIMARY KEY,
  guild_id text NOT NULL, channel_id text NOT NULL, message_id text NOT NULL, user_id text NOT NULL,
  question text, options jsonb, end_at timestamptz,
  outcome jsonb, outcome_message_id text, completed_at timestamptz, terminal_reason text,
  UNIQUE(message_id)
);
CREATE TABLE giveaways (
  id uuid PRIMARY KEY,
  guild_id text NOT NULL, channel_id text NOT NULL, message_id text NOT NULL, user_id text NOT NULL,
  winner_count integer NOT NULL CHECK(winner_count > 0), reaction text, end_at timestamptz NOT NULL,
  winner_ids jsonb, outcome_message_id text, completed_at timestamptz, terminal_reason text,
  UNIQUE(message_id)
);
CREATE TABLE countdowns (
  id uuid PRIMARY KEY,
  guild_id text NOT NULL, channel_id text NOT NULL, message_id text NOT NULL, user_id text NOT NULL,
  message text NOT NULL, end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('pending_confirmation', 'scheduled', 'cancelled', 'completed')),
  confirmation_expires_at timestamptz, outcome_message_id text, completed_at timestamptz, terminal_reason text,
  UNIQUE(message_id)
);
CREATE TABLE error_report_limits (user_id text PRIMARY KEY, reported_at timestamptz NOT NULL);
