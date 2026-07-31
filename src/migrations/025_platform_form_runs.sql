-- =============================================================================
-- MODULE 4 — FORM RUNS & SUBMISSION MANAGEMENT
-- Executive instances of published Forms, with assignment, submission, review.
-- =============================================================================

-- ─── FORM RUNS ───
CREATE TABLE IF NOT EXISTS platform_form_runs (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  form_version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'closed', 'archived', 'cancelled')),
  opens_at TIMESTAMP,
  closes_at TIMESTAMP,
  settings JSONB DEFAULT '{}',
  owner_id TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_runs_form ON platform_form_runs(form_id);
CREATE INDEX IF NOT EXISTS idx_form_runs_status ON platform_form_runs(status);

-- ─── ASSIGNMENTS ───
CREATE TABLE IF NOT EXISTS platform_form_run_assignments (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'user'
    CHECK (target_type IN ('user', 'group', 'program', 'cohort', 'team', 'organization', 'all')),
  target_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(run_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_run ON platform_form_run_assignments(run_id);

-- ─── SUBMISSIONS ───
CREATE TABLE IF NOT EXISTS platform_form_submissions (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
  submitter_id TEXT NOT NULL,
  submitter_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'revision_requested')),
  data JSONB NOT NULL DEFAULT '{}',
  revision_of INTEGER REFERENCES platform_form_submissions(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_run ON platform_form_submissions(run_id);
CREATE INDEX IF NOT EXISTS idx_submissions_submitter ON platform_form_submissions(submitter_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON platform_form_submissions(status);

-- ─── REVIEWS ───
CREATE TABLE IF NOT EXISTS platform_submission_reviews (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT,
  decision TEXT NOT NULL
    CHECK (decision IN ('approved', 'rejected', 'revision_requested', 'escalated', 'reassigned')),
  comment TEXT,
  internal_note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_submission ON platform_submission_reviews(submission_id);

-- ─── TIMELINE ───
CREATE TABLE IF NOT EXISTS platform_submission_timeline (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_submission ON platform_submission_timeline(submission_id);
