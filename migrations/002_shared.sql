ALTER TABLE scheduled_jobs ADD COLUMN deduplication_key text UNIQUE;
