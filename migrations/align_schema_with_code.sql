-- =============================================================================
-- ALIGN THE LIVE SCHEMA WITH THE CODE — single source of truth
-- =============================================================================
-- Every column in the executable part below is read or written by application
-- code. Nothing here is speculative, and no existing column is ever renamed or
-- dropped: the file only adds what is missing.
--
-- Contract this file keeps (scripts/db-audit/apply-align-migration.mjs relies
-- on it to split the file reliably):
--   * ONE STATEMENT PER LINE, each terminated by ';'
--   * a trailing '--' comment after the ';' is allowed and expected
--   * never a ';' inside a string literal
--   * never a statement split across two lines
--   * every statement is idempotent, so the whole file is safe to re-run
--   * every line starting with '--' is never executed. Sections 6, 7 and 8 are
--     REPORTING ONLY and must be run deliberately, by hand, one query at a time.
--
-- Sections 1-4 also benefit from the app's on-demand self-healing, which runs
-- from the request paths that need the columns. Section 5 (program fields) and
-- v2_document_requirements.due_date (section 3) are NOT fully covered by that
-- self-healing, which is why this file exists as the explicit path.
--
-- Apply with:
--   node scripts/db-audit/apply-align-migration.mjs           -> dry run
--   node scripts/db-audit/apply-align-migration.mjs --apply   -> execute
-- =============================================================================


-- =============================================================================
-- SECTION 1 — WEEKLY REPORTS (v2_weekly_reports)
-- =============================================================================
-- The report writer (src/models/curriculum.js, upsertWeeklyReport) inserts 31
-- columns: six pre-existing ones (program_id, week_number, teacher_id,
-- teacher_name, progress_notes, reception_score) plus the 25 added below.
-- Types are taken verbatim from scripts/migrations/add_report_columns.mjs so the
-- shape matches what that script intended.
--
-- The app ALSO self-heals this table on demand (ensureWeeklyReportSchema, called
-- from the report save paths), so this section is the explicit belt-and-braces
-- path: it makes the columns exist instead of waiting for a save to trip them.
-- Keep both — the self-healing is what protects a database nobody has migrated.
-- -----------------------------------------------------------------------------
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS week_status VARCHAR(50) DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS week_rating VARCHAR(50) DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS main_topic TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS assignment_given BOOLEAN DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS assignment_kpi_ids TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS assignment_objective TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS assignment_outcome TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS attendance_level VARCHAR(50) DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS participation_level VARCHAR(50) DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS participants_need_attention BOOLEAN DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS participants_attention_notes TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS standout_participants BOOLEAN DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS standout_notes TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS delivery_quality VARCHAR(50) DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS participant_understanding VARCHAR(50) DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS delivery_challenges BOOLEAN DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS delivery_challenge_note TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS had_issues BOOLEAN DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS issue_types TEXT[] DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS requires_admin_attention BOOLEAN DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS additional_issue_note TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS program_on_track BOOLEAN DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS planned_adjustments TEXT DEFAULT NULL;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- The writer's merge clause is ON CONFLICT (program_id, week_number, teacher_id),
-- so this unique key must exist or EVERY report save fails. The column name is
-- deliberate: 'teacher_id' is the stored author column and is NOT renamed — the
-- product retired the persona, not the column.
-- Note: the base schema (supabase/v2_schema_init.sql) already declares this as an
-- inline UNIQUE constraint, so on a fresh database this index is a redundant
-- second unique index covering the same columns. That is intentional: it is the
-- same object the app's own self-healing creates, and it is what makes the upsert
-- work on databases built before that inline declaration existed.
-- If the index cannot be created, duplicate rows exist. Detect them FIRST with
-- the query in section 8, then resolve them by hand before re-running this file.
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_weekly_reports_week_key ON v2_weekly_reports (program_id, week_number, teacher_id);


-- =============================================================================
-- SECTION 2 — PROGRAM WEEKS (v2_sessions)
-- =============================================================================
-- Column set mirrors the app's own runner
-- (src/app/api/admin/run-migration/route.js) plus the two ensure* helpers in
-- src/models/curriculum.js (timezone, version).
--
-- OPEN PRODUCT QUESTION (not a bug to fix here): the base schema already gives
-- this table a person column, v2_sessions.teacher_id ("User ID of the assigned
-- staff/teacher"). The code instead reads and writes handler_id / handler_name.
-- Whether teacher_id and handler_id are the same concept — one column with two
-- names, or two genuinely different assignees — is unresolved; nothing in the
-- repository decides it. No column is renamed until that is answered.
-- -----------------------------------------------------------------------------
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not started';
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS assignment_type TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS handler_name TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS handler_id TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS kpi_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS team_id TEXT;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1; -- written by the session editor, read by nothing (verify before removal)
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS task_type TEXT; -- written by the session editor, read by nothing (verify before removal)
ALTER TABLE v2_sessions ADD COLUMN IF NOT EXISTS extra_materials JSONB DEFAULT '[]'::jsonb;

-- Session snapshot table — created on demand by the app
-- (createSessionVersionsTable in src/models/curriculum.js). Declared here so a
-- database that has never taken a session edit still has it before the first one.
CREATE TABLE IF NOT EXISTS v2_session_versions (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, session_id UUID NOT NULL, version INTEGER NOT NULL, snapshot JSONB NOT NULL, changed_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW());


-- =============================================================================
-- SECTION 3 — DELIVERABLES (v2_document_requirements)
-- =============================================================================
-- Column set mirrors the app's runner plus the four ensure* helpers in
-- src/models/curriculum.js (resource_url, resource_label, assignee_type,
-- assignee_id).
--
-- *** THE ONE GENUINE GAP IN THIS FILE ***
-- due_date is the only column here that the app's own migration runner does NOT
-- carry AND that the on-demand self-healing does NOT cover. It is written by the
-- requirement writer (addSessionRequirement / updateRequirement in
-- src/models/curriculum.js, called from the PM curriculum route) and read by the
-- participant views. On a drifted database, creating a session with requirements
-- therefore fails with 42703 (column "due_date" does not exist) and cannot
-- repair itself. This file is the only path that closes it.
-- -----------------------------------------------------------------------------
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS session_id INTEGER;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS allowed_format TEXT DEFAULT 'pdf';
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS kpi_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS assignee_type TEXT;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS assignee_id TEXT;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_url TEXT;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_label TEXT;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS weight INTEGER DEFAULT 1; -- read by the participant assignment payload, not dead
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS week_number INTEGER; -- read by participant/home to place a requirement in a week, not dead


-- =============================================================================
-- SECTION 4 — GRADING (v2_submissions)
-- =============================================================================
-- Column set mirrors the app's runner. Types follow how the code binds each
-- value: JSON payloads bound as an object or cast with ::jsonb become JSONB,
-- everything else stays TEXT/INTEGER like its sibling columns.
--
-- The app ALSO self-heals several of these on demand (ensureSubmissions* helpers
-- in src/models/forms.js), so this section is the explicit path.
-- -----------------------------------------------------------------------------
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1; -- current version counter, read by getExistingSubmission
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS supporting_url TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS review_action TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS document_id INTEGER;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS team_id TEXT;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS evaluation_score INTEGER DEFAULT NULL;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS reviewed_by_role TEXT DEFAULT NULL;
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS evaluation_data JSONB DEFAULT '{}'::jsonb; -- read by the API layer, displayed nowhere: candidate for removal
ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- The review flow enforces this status vocabulary in code, so the constraint must
-- accept exactly those values. Dropped and re-added so an older, narrower
-- constraint cannot reject a valid review.
ALTER TABLE v2_submissions DROP CONSTRAINT IF EXISTS v2_submissions_status_check;
ALTER TABLE v2_submissions ADD CONSTRAINT v2_submissions_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'revision_requested', 'pending_followup'));

-- Submission version snapshot table — written by the code (archiveSubmissionVersion
-- in src/models/participantPortal.js) and displayed nowhere: candidate for removal.
-- Ids are TEXT on purpose: the writer binds cids, integer requirement ids and
-- UUIDs through the same columns without casts, so a UUID-typed column would
-- reject valid writes. The older migrations/add_submission_versions.sql carries a
-- DIFFERENT, SQLite-flavoured shape (version_number / link_url / notes) that can
-- never have created this table on PostgreSQL; that file is superseded by this one.
CREATE TABLE IF NOT EXISTS v2_submission_versions (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, submission_id TEXT, participant_id TEXT, deliverable_id TEXT, file_url TEXT, version INTEGER DEFAULT 1, created_at TIMESTAMPTZ DEFAULT NOW());


-- =============================================================================
-- SECTION 5 — PROGRAM FIELDS (v2_programs)
-- =============================================================================
-- PROVENANCE: this list came from the app's existing migration runner
-- (MIGRATION_STATEMENTS in src/app/api/admin/run-migration/route.js) and was then
-- verified by search — NOT by a field-by-field audit of the programs UI. Each
-- column below was confirmed to be read or written somewhere in src/.
--
-- DROPPED from that runner's list: participant_limit. It appears ONLY in the
-- migration statements themselves (here and in scripts/db-audit/apply-migrations.mjs)
-- and in no read or write path, so adding it would create a column the app never
-- touches. Restore it only if a capacity check is actually built.
--
-- registration_window is read-only in current code (the public group-info
-- endpoint and the registration page read it; nothing writes it). It is kept
-- because the public sign-up path depends on it existing.
-- -----------------------------------------------------------------------------
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS concept_note TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS vision TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS objectives TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT 'incubation';
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private';
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS registration_window TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS note_id TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS assigned_assistant_id TEXT;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS is_archived INTEGER DEFAULT 0;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS materials JSONB DEFAULT '[]'::jsonb;
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS evaluation_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE v2_programs DROP CONSTRAINT IF EXISTS v2_programs_grading_mode_check;
ALTER TABLE v2_programs ADD CONSTRAINT v2_programs_grading_mode_check CHECK (grading_mode IN ('graded', 'review', 'followup', 'academic', 'incubation'));


-- =============================================================================
-- SECTION 6 — RETIRED ROLE VALUE (REPORTING ONLY — NEVER EXECUTED)
-- =============================================================================
-- The teacher persona was retired from the product, but historical rows may still
-- carry the value. These queries only COUNT such rows; nothing here writes.
-- The first two count the same assignment at its two storage sites: the program
-- staff assignment and the mirrored contact_roles row that goes with it. The
-- mirror writes the value into BOTH contact_roles.role and contact_roles.title.
--
-- SELECT COUNT(*) AS program_staff_rows FROM v2_program_staff WHERE role = 'teacher';
-- SELECT COUNT(*) AS mirrored_contact_role_rows FROM contact_roles WHERE role = 'teacher' OR title = 'teacher';
-- SELECT COUNT(*) AS grading_rows FROM v2_submissions WHERE reviewed_by_role = 'teacher';
--
-- Replacement template. ALL THREE statements below are comments: the placeholder
-- must NOT be replaced with anything without a deliberate decision, because the
-- mirrored contact_roles row (role/title plus capability_overrides) is what GRANTS
-- CAPABILITIES to that person — choosing the replacement is an access decision,
-- not a naming cleanup. Picking a manager-type value silently widens access;
-- picking a role the capability layer no longer knows narrows it to nothing.
-- Decide per row, with the affected person's manager, then replace <replacement>
-- once, here, and run the three statements by hand.
--
-- UPDATE v2_program_staff SET role = '<replacement>' WHERE role = 'teacher';
-- UPDATE contact_roles SET role = '<replacement>', title = '<replacement>' WHERE role = 'teacher' OR title = 'teacher';
-- UPDATE v2_submissions SET reviewed_by_role = '<replacement>' WHERE reviewed_by_role = 'teacher';
--
-- Note on the third statement: the review lock in src/app/api/submissions/route.js
-- no longer recognises the retired value, so those lock rows are already inert.
-- Rewriting them is cosmetic and can be skipped without changing behaviour.


-- =============================================================================
-- SECTION 7 — DECISION REQUIRED: GOAL PROGRESS (kpi_progress) — EXCLUDED
-- =============================================================================
-- Deliberately NOT part of the executable part of this file. The repository holds
-- three mutually incompatible definitions of this table, and adding columns from
-- the wrong one is actively harmful: the app reads this table as a progress cache
-- inside a try/catch that swallows failures, so a wrong shape does not error
-- loudly — it silently reports 0% progress to the PM and admin dashboards, and
-- the code's own "never downgrade a non-zero rate" guard stops working.
--
-- The three definitions, with where each was found:
--   1. src/migrations/kpi_progress_table.sql — a pre-computed COUNTER shape:
--      linked_sessions, completed_sessions, linked_docs, completed_docs,
--      total_items, completed_items, progress DECIMAL(5,2), weight DECIMAL(5,2),
--      updated_at, with UNIQUE (kpi_id, program_id). No completion_rate.
--   2. scripts/create_kpi_progress_table.js — a CACHE shape:
--      completion_rate INTEGER, participant_count, approved_count, calculated_at,
--      with UNIQUE (program_id, kpi_id). No kpi_name, no counters.
--   3. What the live code actually writes and reads —
--      src/models/kpi-progress.js (recalculateKpiProgress, getCachedKpiProgress)
--      and scripts/seed_kpi_progress.js: INSERT/UPDATE on program_id, kpi_id,
--      kpi_name, completion_rate, participant_count, approved_count,
--      calculated_at, ON CONFLICT (program_id, kpi_id); and
--      src/app/admin/reports/responses/page.js reads kpi_name.
--      Shape 3 is the only one that satisfies the code, and neither 1 nor 2
--      declares kpi_name at all.
--
-- ACTION BEFORE ANY DDL: read the LIVE column list, decide, then write the
-- statements for shape 3 explicitly. Do not infer this table from the repo.
--
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'kpi_progress' ORDER BY ordinal_position;
-- SELECT indexdef FROM pg_indexes WHERE tablename = 'kpi_progress';


-- =============================================================================
-- SECTION 8 — VERIFICATION (REPORTING ONLY — RUN BY HAND AFTER A RUN)
-- =============================================================================
-- Each query lists the columns that are STILL missing for one table after a run:
-- an empty result means that table is aligned. The final query confirms the
-- unique key the report writer depends on.
--
-- SELECT m.pair FROM unnest(ARRAY['week_status','week_rating','main_topic','assignment_given','assignment_kpi_ids','assignment_objective','assignment_outcome','attendance_level','participation_level','participants_need_attention','participants_attention_notes','standout_participants','standout_notes','delivery_quality','participant_understanding','delivery_challenges','delivery_challenge_note','had_issues','issue_types','requires_admin_attention','additional_issue_note','program_on_track','planned_adjustments','attachment_type','attachment_url']) AS m(pair) WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_name = 'v2_weekly_reports' AND c.column_name = m.pair);
--
-- SELECT m.pair FROM unnest(ARRAY['description','status','scheduled_date','end_date','start_time','end_time','assignment_type','handler_name','handler_id','kpi_ids','notes','team_id','timezone','version','weight','task_type','extra_materials']) AS m(pair) WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_name = 'v2_sessions' AND c.column_name = m.pair);
--
-- SELECT m.pair FROM unnest(ARRAY['session_id','allowed_format','kpi_ids','assignee_type','assignee_id','resource_url','resource_label','due_date','weight','week_number']) AS m(pair) WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_name = 'v2_document_requirements' AND c.column_name = m.pair);
--
-- SELECT m.pair FROM unnest(ARRAY['version_number','version','supporting_url','review_action','rejection_reason','document_id','team_id','score','evaluation_score','reviewed_by_role','evaluation_data','updated_at']) AS m(pair) WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_name = 'v2_submissions' AND c.column_name = m.pair);
--
-- SELECT m.pair FROM unnest(ARRAY['concept_note','vision','objectives','program_type','visibility','registration_window','language','note_id','assigned_assistant_id','is_archived','materials','evaluation_config']) AS m(pair) WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_name = 'v2_programs' AND c.column_name = m.pair);
--
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'v2_weekly_reports' AND indexname = 'idx_v2_weekly_reports_week_key';
--
-- Duplicate rows that would block the unique key in section 1 (must be empty):
-- SELECT program_id, week_number, teacher_id, COUNT(*) AS duplicate_rows FROM v2_weekly_reports GROUP BY program_id, week_number, teacher_id HAVING COUNT(*) > 1 ORDER BY duplicate_rows DESC;
