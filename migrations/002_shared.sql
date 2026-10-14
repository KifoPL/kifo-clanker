ALTER TABLE scheduled_jobs ADD COLUMN IF NOT EXISTS deduplication_key text UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS scheduled_jobs_deduplication_key_key ON scheduled_jobs (deduplication_key);
