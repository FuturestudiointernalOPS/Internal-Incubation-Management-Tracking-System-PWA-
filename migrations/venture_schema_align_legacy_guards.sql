-- =============================================================================
-- GUARDED COLUMN ADDITIONS FOR THE FIVE UNVERIFIED TABLES - pure SQL
-- =============================================================================
-- USE THIS WITH migrations/venture_schema_align.sql WHEN YOU PASTE INTO THE
-- SUPABASE SQL EDITOR INSTEAD OF RUNNING THE SCRIPT.
--
-- WHY IT EXISTS. The node runner collects a failure and carries on. The SQL
-- editor does NOT: it sends the whole paste as one batch, so the FIRST error
-- aborts everything after it and rolls the batch back. venture_schema_align.sql
-- contains 16 ALTER/CREATE statements against five tables that may not exist on
-- production - and if one of them fails there, nothing else in the file lands.
--
-- So: in venture_schema_align.sql, DELETE these two blocks, paste the rest, and
-- then paste this file. Same end state, and nothing can abort.
--
--   BLOCK 1 - delete these 2 lines:
--     ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS venture_id TEXT;
--     ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP;
--
--   BLOCK 2 - delete these 15 lines (the "-- KPI library extension" line down to
--   the idx_user_sessions_token_hash index, inclusive):
--     ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT;
--     ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS frequency TEXT;
--     ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS measurement_method TEXT;
--     ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS default_target NUMERIC;
--     ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS metadata JSONB;
--     ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS created_by TEXT;
--     ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_cid TEXT;
--     ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_name TEXT;
--     ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS details JSONB;
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS device TEXT;
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS browser TEXT;
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS os TEXT;
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS country TEXT;
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP;
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS logout_time TIMESTAMP;
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'active';
--     ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
--     CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash) WHERE token_hash IS NOT NULL;
--
-- THE STATEMENTS BELOW DO THE SAME WORK, BUT ONLY WHERE THE TABLE EXISTS, so a
-- missing table is a no-op instead of an error. to_regclass() returns NULL for a
-- table that is not present, which is exactly the test needed.
--
-- Safe to run more than once, and safe to run even if production HAS all five
-- tables - then it simply adds the columns the main file would have added.
-- =============================================================================


-- v2_teams — the promotion columns the promote route writes
DO $$ BEGIN
  IF to_regclass('public.v2_teams') IS NOT NULL THEN
    ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS venture_id TEXT;
    ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP;
  END IF;
END $$;


-- venture_kpi_definitions — KPI library extension (formula / frequency / measurement)
DO $$ BEGIN
  IF to_regclass('public.venture_kpi_definitions') IS NOT NULL THEN
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS frequency TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS measurement_method TEXT;
    ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS default_target NUMERIC;
  END IF;
END $$;


-- venture_history — provenance columns
DO $$ BEGIN
  IF to_regclass('public.venture_history') IS NOT NULL THEN
    ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS metadata JSONB;
    ALTER TABLE venture_history ADD COLUMN IF NOT EXISTS created_by TEXT;
  END IF;
END $$;


-- venture_activity_log — actor attribution
DO $$ BEGIN
  IF to_regclass('public.venture_activity_log') IS NOT NULL THEN
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_cid TEXT;
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS actor_name TEXT;
    ALTER TABLE venture_activity_log ADD COLUMN IF NOT EXISTS details JSONB;
  END IF;
END $$;


-- user_sessions — device/session telemetry and the hashed session token
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
