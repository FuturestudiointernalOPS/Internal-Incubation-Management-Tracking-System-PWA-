-- =============================================================================
-- AI EVALUATION — SEPARATE STORAGE (CORRECTED ARCHITECTURE)
-- Evaluations and reviews are independent layers on top of submissions.
-- Original submission data is never modified by AI.
-- =============================================================================

-- ─── AI Evaluation Results (separate from submission data) ───
CREATE TABLE IF NOT EXISTS platform_submission_evaluations (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
  framework_id INTEGER REFERENCES platform_evaluation_frameworks(id) ON DELETE SET NULL,
  evaluated_by TEXT NOT NULL DEFAULT 'ai',
  model TEXT DEFAULT 'deepseek-chat',
  dimensions JSONB NOT NULL,
  overall_score NUMERIC(5,1),
  ranking TEXT,
  recommendation TEXT,
  confidence NUMERIC(4,3),
  evaluated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(submission_id, evaluated_at)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_submission ON platform_submission_evaluations(submission_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_framework ON platform_submission_evaluations(framework_id);

-- ─── Drop any inline evaluation data from existing submissions ───
-- (preserves original answers, removes only _evaluation metadata)
-- Run this migration script separately if needed on existing data.
