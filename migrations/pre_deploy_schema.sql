-- =============================================================================
-- PRE-DEPLOYMENT SCHEMA — Email/Activation/Role/Filtering release
-- Safe to run on STAGING and PRODUCTION. Every statement is idempotent
-- (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS).
-- No destructive statements. No data loss.
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CORE PLATFORM (Forms / Runs / Submissions / Evaluations)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS platform_collections (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id INTEGER REFERENCES platform_collections(id) ON DELETE SET NULL,
  owner_id TEXT,
  owner_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','public','restricted')),
  tags TEXT[],
  category TEXT,
  icon TEXT DEFAULT 'FolderKanban',
  color TEXT DEFAULT '#FF6600',
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_forms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  collection_id INTEGER REFERENCES platform_collections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','public','restricted')),
  version INTEGER NOT NULL DEFAULT 1,
  settings JSONB DEFAULT '{}',
  created_by TEXT,
  owner_id TEXT,
  owner_name TEXT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_form_sections (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_form_fields (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  section_id INTEGER REFERENCES platform_form_sections(id) ON DELETE SET NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  default_value TEXT,
  options JSONB,
  validation JSONB DEFAULT '{}',
  conditional_logic JSONB,
  calculation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_form_versions (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  published_at TIMESTAMP,
  published_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(form_id, version)
);

CREATE TABLE IF NOT EXISTS platform_form_runs (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES platform_forms(id) ON DELETE CASCADE,
  form_version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  opens_at TIMESTAMP,
  closes_at TIMESTAMP,
  settings JSONB DEFAULT '{}',
  owner_id TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_form_run_assignments (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL DEFAULT 'user',
  target_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(run_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS platform_form_submissions (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
  submitter_id TEXT NOT NULL,
  submitter_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','revision_requested')),
  data JSONB NOT NULL DEFAULT '{}',
  revision_of INTEGER REFERENCES platform_form_submissions(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_submission_reviews (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected','revision_requested','escalated','reassigned')),
  comment TEXT,
  internal_note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_submission_timeline (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES platform_form_submissions(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_submissions_rate (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES platform_form_runs(id) ON DELETE CASCADE,
  ip TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

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

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. EMAIL LOG (idempotency + activation/access tracking)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS platform_email_log (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER,
  contact_cid TEXT,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE platform_email_log ADD COLUMN IF NOT EXISTS recipient TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_log_once
  ON platform_email_log (submission_id, email_type) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_email_log_lookup
  ON platform_email_log (submission_id, email_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. BATCHED AI EVALUATION HELPERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS platform_evaluation_claims (
  submission_id INTEGER PRIMARY KEY,
  claimed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_evaluation_failures (
  submission_id INTEGER PRIMARY KEY,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. HISTORICAL IMPORT HELPERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS platform_import_batches (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL,
  run_id INTEGER NOT NULL,
  file_hash TEXT NOT NULL,
  total_rows INTEGER DEFAULT 0,
  imported INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  needs_review INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_import_review_flags (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER,
  form_id INTEGER NOT NULL,
  run_id INTEGER NOT NULL,
  row_number INTEGER,
  applicant_name TEXT,
  applicant_email TEXT,
  matched_cid TEXT,
  matched_name TEXT,
  method TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. PASSWORD SETUP TOKENS (activation/access)
--    NOTE: correct shape = contact_cid (NOT user_cid), used INTEGER (NOT BOOLEAN)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS password_setup_tokens (
  id SERIAL PRIMARY KEY,
  contact_cid TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_contact ON password_setup_tokens(contact_cid);

-- Repair environments where `used` was created as BOOLEAN: the code writes
-- integers (used = 0/1), which fails with
-- "column 'used' is boolean but expression is of type integer" and breaks
-- activation emails + password setup. Safe/idempotent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_setup_tokens' AND column_name = 'used' AND data_type = 'boolean'
  ) THEN
    ALTER TABLE password_setup_tokens ALTER COLUMN used DROP DEFAULT;
    ALTER TABLE password_setup_tokens ALTER COLUMN used TYPE INTEGER USING CASE WHEN used THEN 1 ELSE 0 END;
    ALTER TABLE password_setup_tokens ALTER COLUMN used SET DEFAULT 0;
  END IF;
END $$;

-- Repair tables created by the LEGACY script (user_cid/user_email NOT NULL,
-- no contact_cid): the app writes contact_cid and leaves those legacy
-- columns NULL, which violates their NOT NULL constraints.
ALTER TABLE password_setup_tokens ADD COLUMN IF NOT EXISTS contact_cid TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_setup_tokens' AND column_name = 'user_cid'
  ) THEN
    ALTER TABLE password_setup_tokens ALTER COLUMN user_cid DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_setup_tokens' AND column_name = 'user_email'
  ) THEN
    ALTER TABLE password_setup_tokens ALTER COLUMN user_email DROP NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'password_setup_tokens' AND column_name = 'contact_cid'
  ) THEN
    UPDATE password_setup_tokens SET contact_cid = user_cid
    WHERE contact_cid IS NULL AND user_cid IS NOT NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. PROGRAM MEMBERSHIP
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS participant_programs (
  id SERIAL PRIMARY KEY,
  participant_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at TIMESTAMP DEFAULT NOW(),
  source TEXT DEFAULT 'manual',
  UNIQUE(participant_id, program_id)
);
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS outcome TEXT;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE participant_programs ADD COLUMN IF NOT EXISTS certificate_issued BOOLEAN DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. CONTACTS COLUMNS (identity / activation state / program context / archive)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'participant';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT '';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS program_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS archived_by TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_by TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_archived_at ON contacts(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at) WHERE deleted_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. FAMILIES COLUMNS (Group → Program context)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE families ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS default_role TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0;
ALTER TABLE families ADD COLUMN IF NOT EXISTS registration_id TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS program_id TEXT;
ALTER TABLE families ADD COLUMN IF NOT EXISTS form_id UUID;
CREATE INDEX IF NOT EXISTS idx_families_form_id ON families(form_id);

-- =============================================================================
-- END OF PRE-DEPLOYMENT SCHEMA
-- =============================================================================
