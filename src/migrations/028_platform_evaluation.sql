-- =============================================================================
-- MODULE 5 EXTENSION — AI EVALUATION FRAMEWORKS
-- Stores AI-generated evaluation configurations for forms.
-- Additive only — no existing columns modified.
-- =============================================================================

CREATE TABLE IF NOT EXISTS platform_evaluation_frameworks (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  source_document TEXT,
  framework JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(form_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_frameworks_form ON platform_evaluation_frameworks(form_id);
