-- =============================================================================
-- READ-ONLY AUDIT — what type is a Venture id on THIS database?
-- =============================================================================
-- The schema-align file hit 42804 on production:
--   foreign key constraint "venture_journey_stages_venture_id_fkey" cannot be
--   implemented — key columns "venture_id" and "id" ... uuid and integer.
-- So production's ventures.id is an INTEGER while staging's is a UUID, and the
-- two databases hold DIFFERENT ventures DDL:
--   src/migrations/010_ventures.sql          -> id SERIAL,  venture_id TEXT UNIQUE
--   src/migrations/venture_os_track1_foundation.sql -> id UUID
-- Everything downstream that keys a table on ventures(id) instead of on the TEXT
-- ventures(venture_id) code is affected. These queries say exactly how far that
-- reaches. Nothing here writes.
--
-- Run:
--   node scripts/db-audit/run-readonly.mjs migrations/audit_venture_id_types.sql .env.local
--   node scripts/db-audit/run-readonly.mjs migrations/audit_venture_id_types.sql .env.audit-staging
-- =============================================================================

-- Q1. The identity of this database and its ventures table.
SELECT current_database() AS db, current_user AS usr, (SELECT count(*) FROM ventures) AS ventures_rows;

-- Q2. Is ventures.id an integer or a uuid here? And does the TEXT code column exist?
SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ventures' AND column_name IN ('id', 'venture_id', 'name', 'company_name') ORDER BY column_name;

-- Q3. Every column that carries a venture id, and its type. The rows where the
-- type differs from ventures.id are the ones a join cannot cross.
SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.column_name IN ('id', 'venture_id') AND c.table_name IN ('ventures', 'venture_founders', 'venture_members', 'venture_milestones', 'venture_tasks', 'venture_sessions', 'venture_notes', 'venture_reports', 'venture_origins', 'venture_staff_assignments', 'venture_journey_stages', 'venture_facilitator_playbook', 'v2_teams') ORDER BY c.table_name, c.column_name;

-- Q4. Every foreign key that points AT ventures. This is the set of tables whose
-- venture id must stay type-compatible with ventures' referenced column.
SELECT conrelid::regclass::text AS from_table, conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.ventures'::regclass ORDER BY 1;

-- Q5. Do the two tables that key on ventures(id) exist yet?
SELECT to_regclass('public.venture_journey_stages') AS journey_stages, to_regclass('public.venture_facilitator_playbook') AS playbook;

-- Q6. THE DECISIVE TEST. `JOIN ventures v ON v.id = m.venture_id` is what
-- src/app/api/ventures/[id]/milestones/archive/route.js and
-- .../tasks/archive/route.js run. If this errors with 42883
-- ("operator does not exist: integer = text") those two routes cannot work on
-- this database. If it returns a row, they can.
SELECT v.id AS ventures_id, v.venture_id AS ventures_code, m.venture_id AS milestone_venture_id, t.venture_id AS task_venture_id FROM ventures v LEFT JOIN venture_milestones m ON v.id = m.venture_id LEFT JOIN venture_tasks t ON v.id = t.venture_id LIMIT 5;

-- Q7. (removed — the per-table row counts need every table to exist, and on
-- production 60 of them do not. Q1 answers the only part that matters: how many
-- Ventures are there.)

-- Q8. Which of the venture tables the new code needs are still absent?
-- Q9. THE VALUES, not the types. A milestone's venture_id may hold the internal
-- id (ventures.id) or the VNT- code (ventures.venture_id) — the two conventions
-- coexist in this schema, which is why a join on v.id alone caught some tables
-- and missed others. This prints both, side by side, for the same Venture.
SELECT v.id::text AS venture_internal_id, v.venture_id AS venture_code FROM ventures v ORDER BY 1 LIMIT 10;

-- Q10. Which convention does each table's venture_id actually store? A row here
-- means the value matches the internal id (col 2) or the code (col 3).
SELECT m.venture_id::text AS milestone_venture_id, bool_or(m.venture_id::text = v.id::text) AS matches_internal_id, bool_or(m.venture_id::text = v.venture_id) AS matches_code FROM venture_milestones m CROSS JOIN ventures v GROUP BY 1;

-- Q12. PROOF FOR THE ARCHIVE ROUTES' FIX. The route now joins on
-- (m.venture_id::text = v.id::text OR m.venture_id::text = v.venture_id). This
-- must return a count WITHOUT erroring on both databases. Staging: 3 (it has 3
-- milestones on 1 venture). Production: 0 (0 ventures) — but no error, which is
-- the whole point; the old v.id = m.venture_id raised 42883 here.
SELECT count(*) AS milestones_matched FROM venture_milestones m JOIN ventures v ON (m.venture_id::text = v.id::text OR m.venture_id::text = v.venture_id);

-- Q13. Same for the task path. Reports ERR on production only because
-- venture_tasks does not exist there yet — that is B1's job, not this file's.
SELECT count(*) AS tasks_matched FROM venture_tasks t JOIN ventures v ON (t.venture_id::text = v.id::text OR t.venture_id::text = v.venture_id);
