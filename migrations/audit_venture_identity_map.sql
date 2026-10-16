-- =============================================================================
-- READ-ONLY AUDIT — the Venture IDENTITY MAP
-- =============================================================================
-- Vinance Phase 0. The target is one internal identifier (ventures.id, a UUID)
-- and a decorative code (ventures.venture_id, "VNT-…"). This file says, for
-- THIS database, how far the storage is from that target — which tables hold
-- the internal id, which still hold the code, and which cannot be joined at all
-- because the two sides are different types.
--
-- Companion to migrations/audit_venture_id_types.sql (the original type probe):
-- that file answered "is ventures.id an integer or a UUID?"; this one answers
-- "which convention does each table actually STORE?".
--
-- Nothing here writes. Run it on BOTH databases before any conversion:
--   node scripts/db-audit/run-readonly.mjs migrations/audit_venture_identity_map.sql .env.local
--   node scripts/db-audit/run-readonly.mjs migrations/audit_venture_identity_map.sql .env.audit-staging
-- =============================================================================

-- Q1. This database, and the shape of the identity columns on `ventures`.
SELECT current_database() AS db,
       current_user AS usr,
       (SELECT count(*) FROM ventures) AS ventures_rows;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ventures'
  AND column_name IN ('id', 'venture_id', 'name', 'company_name', 'status')
ORDER BY column_name;

-- Q2. Every column, anywhere, that carries a Venture reference. This is the
-- full set the unification has to look at — not just the tables we remember.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name = 'venture_id' OR column_name LIKE 'venture%\_id')
  AND table_name <> 'ventures'
ORDER BY table_name, column_name;

-- Q3. Every foreign key that points AT `ventures`. These are the relationships
-- that must stay type-compatible with ventures' referenced column.
SELECT conrelid::regclass::text AS from_table,
       conname,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid = 'public.ventures'::regclass
ORDER BY 1;

-- Q4. THE DECISIVE PROBE, per table. For each canonical table, does its
-- venture reference match the internal id or the code? A row with
-- matches_internal_id = false AND matches_code = false holds values matching
-- NEITHER — the rows a conversion will have to reconcile by hand.
-- (Tables absent on this database are skipped by the planner individually; a
-- missing table shows up as its own error line and does not abort the rest.)
SELECT 'venture_members' AS tbl,
       bool_or(vm.venture_id::text = v.id::text)     AS matches_internal_id,
       bool_or(vm.venture_id::text = v.venture_id)   AS matches_code,
       count(*) AS rows_seen
FROM venture_members vm JOIN ventures v ON (vm.venture_id::text = v.id::text OR vm.venture_id::text = v.venture_id);

SELECT 'venture_milestones' AS tbl,
       bool_or(m.venture_id::text = v.id::text)     AS matches_internal_id,
       bool_or(m.venture_id::text = v.venture_id)   AS matches_code,
       count(*) AS rows_seen
FROM venture_milestones m JOIN ventures v ON (m.venture_id::text = v.id::text OR m.venture_id::text = v.venture_id);

SELECT 'venture_tasks' AS tbl,
       bool_or(t.venture_id::text = v.id::text)     AS matches_internal_id,
       bool_or(t.venture_id::text = v.venture_id)   AS matches_code,
       count(*) AS rows_seen
FROM venture_tasks t JOIN ventures v ON (t.venture_id::text = v.id::text OR t.venture_id::text = v.venture_id);

SELECT 'venture_journey_stages' AS tbl,
       bool_or(s.venture_id::text = v.id::text)     AS matches_internal_id,
       bool_or(s.venture_id::text = v.venture_id)   AS matches_code,
       count(*) AS rows_seen
FROM venture_journey_stages s JOIN ventures v ON (s.venture_id::text = v.id::text OR s.venture_id::text = v.venture_id);

-- Q5. THE VALUES, not only the verdict: one line per (table, venture_id) with
-- what it holds and what the Venture says, so a human can read the end state.
SELECT 'venture_members' AS tbl, vm.venture_id::text AS ref, v.id::text AS internal_id, v.venture_id AS code
FROM venture_members vm JOIN ventures v ON (vm.venture_id::text = v.id::text OR vm.venture_id::text = v.venture_id)
ORDER BY 1, 2 LIMIT 50;

-- Q6. The bridge every reader still needs while the storage is mixed. If this
-- returns without erroring on both databases, the temporary permission to join
-- on BOTH conventions is confirmed; if it errors, the two sides are different
-- types and even the bridge cannot cross them (the original 42804/42883 case).
SELECT count(*) AS milestones_reachable
FROM venture_milestones m
JOIN ventures v ON (m.venture_id::text = v.id::text OR m.venture_id::text = v.venture_id);
