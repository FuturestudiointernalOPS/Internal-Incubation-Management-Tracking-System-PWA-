-- Add deduplication, categorization, and richer context to error_logs
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS occurrence_count INTEGER DEFAULT 1;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS user_role TEXT;

CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON error_logs(message, page);
