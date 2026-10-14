CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id text PRIMARY KEY,
  prefix text NOT NULL CHECK (length(prefix) BETWEEN 1 AND 100)
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL,
  run_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_jobs_due_idx ON scheduled_jobs (run_at, id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS scheduled_jobs_lease_idx ON scheduled_jobs (lease_until, id) WHERE status = 'running';
