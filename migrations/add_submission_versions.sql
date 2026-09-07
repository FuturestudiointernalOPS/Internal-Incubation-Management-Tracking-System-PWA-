-- =============================================================================
-- Migration: v2_submission_versions — Version History Tracking
-- =============================================================================
-- Tracks every submission version for team deliverables.
-- Each time a team re-submits, a new version record is created.

CREATE TABLE IF NOT EXISTS v2_submission_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  version_number INTEGER NOT NULL DEFAULT 1,
  file_url TEXT,
  link_url TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES v2_submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_submission_versions_submission_id
  ON v2_submission_versions(submission_id);

-- Backfill: Insert existing submissions as version 1
INSERT OR IGNORE INTO v2_submission_versions (submission_id, version_number, file_url, created_at)
SELECT id, 1, file_url, created_at
FROM v2_submissions
WHERE file_url IS NOT NULL;
