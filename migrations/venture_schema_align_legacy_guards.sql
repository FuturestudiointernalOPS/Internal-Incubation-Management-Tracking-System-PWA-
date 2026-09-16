-- =============================================================================
-- GUARDED STATEMENTS FOR THE SUPABASE SQL EDITOR - pure SQL
-- =============================================================================
-- USE THIS INSTEAD OF THE CORRESPONDING LINES IN
-- migrations/venture_schema_align.sql WHEN YOU PASTE INTO THE SUPABASE SQL
-- EDITOR INSTEAD OF RUNNING THE NODE SCRIPT.
--
-- WHY IT EXISTS. The node runner collects a failure and carries on. The SQL
-- editor does NOT: it sends the paste as one batch, so the FIRST error aborts
-- everything after it and rolls the batch back. venture_schema_align.sql holds
-- statements that are allowed to fail on a database whose shape differs from
-- staging's, and every one of them would take the rest of the file down with it.
--
-- SO: in venture_schema_align.sql, DELETE the four blocks listed below, paste
-- the rest, then paste this file. Same end state, nothing can abort.
--
-- -----------------------------------------------------------------------------
-- BLOCK 1 - DELETE these 2 lines (table may not exist):
--   ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS venture_id TEXT;
--   ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP;
--
-- BLOCK 2 - DELETE these 18 lines, from "-- KPI library extension" down to the
-- idx_user_sessions_token_hash index inclusive (these tables may not exist):
--   ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT;
--   ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS frequency TEXT;
--   ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS measurement_method TEXT;
--   ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS default_target NUMERIC;
--   ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS metadata JSONB;
--   ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS created_by TEXT;
--   ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_cid TEXT;
--   ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_name TEXT;
--   ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS details JSONB;
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device TEXT;
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS browser TEXT;
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS os TEXT;
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country TEXT;
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS logout_time TIMESTAMP;
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active';
--   ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
--   CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash) WHERE token_hash IS NOT NULL;
--
-- BLOCK 3 - DELETE these 2 lines. THIS IS THE ONE THAT ALREADY FAILED:
-- 42703 column "contact_id" of relation "venture_founders" does not exist.
-- ADD COLUMN IF NOT EXISTS never errors on a missing column, but ALTER COLUMN
-- ... DROP NOT NULL does, and production's venture_founders predates contact_id.
--   ALTER TABLE venture_founders ALTER COLUMN contact_id DROP NOT NULL;
--   ALTER TABLE ventures ALTER COLUMN name DROP NOT NULL;
--
-- BLOCK 4 - DELETE these 2 lines (platform_form_submissions is unverified):
--   ALTER TABLE platform_form_submissions ADD COLUMN IF NOT EXISTS invitation_id INTEGER;
--   CREATE INDEX IF NOT EXISTS idx_form_submissions_invitation ON platform_form_submissions(invitation_id);
-- -----------------------------------------------------------------------------
--
-- EVERYTHING BELOW IS A NO-OP WHEN THE TARGET IS ABSENT, so it is safe to run
-- even if production turns out to have all of these tables. Safe to re-run.
-- =============================================================================


-- =============================================================================
-- BLOCK 1 (guarded) - v2_teams promotion columns
-- =============================================================================
DO $$ BEGIN
  IF to_regclass('public.v2_teams') IS NOT NULL THEN
    ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS venture_id TEXT;
    ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP;
  END IF;
END $$;


-- =============================================================================
-- BLOCK 2 (guarded) - KPI library, legacy provenance and session telemetry
-- =============================================================================
DO $$ BEGIN
  IF to_regclass('public.venture_kpi_definitions') IS NOT NULL THEN
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS frequency TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS measurement_method TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS default_target NUMERIC;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.venture_history') IS NOT NULL THEN
    ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS metadata JSONB;
    ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS created_by TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.venture_activity_log') IS NOT NULL THEN
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_cid TEXT;
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_name TEXT;
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS details JSONB;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS browser TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS os TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS logout_time TIMESTAMP;
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active';
    ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash) WHERE token_hash IS NOT NULL;
  END IF;
END $$;


-- =============================================================================
-- BLOCK 3 (guarded) - the legacy NOT NULL relaxations.
-- These use an EXCEPTION handler rather than to_regclass, because the failure
-- here is a missing COLUMN on a table that exists, not a missing table. This is
-- belt-and-braces: it survives either shape.
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE venture_founders ALTER COLUMN contact_id DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
          WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ventures ALTER COLUMN name DROP NOT NULL;
EXCEPTION WHEN undefined_column THEN NULL;
          WHEN undefined_table THEN NULL;
END $$;


-- =============================================================================
-- BLOCK 4 (guarded) - form submission to invitation link
-- =============================================================================
DO $$ BEGIN
  IF to_regclass('public.platform_form_submissions') IS NOT NULL THEN
    ALTER TABLE platform_form_submissions ADD COLUMN IF NOT EXISTS invitation_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_form_submissions_invitation ON platform_form_submissions(invitation_id);
  END IF;
END $$;
