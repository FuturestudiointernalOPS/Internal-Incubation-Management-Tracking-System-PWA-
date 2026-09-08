-- =============================================================================
-- RATE LIMITING FOR PUBLIC SUBMISSIONS
-- Tracks submissions per IP per run for rate limiting.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_submissions_rate (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
  ip TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_run_ip ON platform_submissions_rate(run_id, ip, created_at);
