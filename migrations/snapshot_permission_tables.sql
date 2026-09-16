-- =============================================================================
-- SNAPSHOT THE PERMISSION TABLES - pure SQL, run in the Supabase SQL editor
-- =============================================================================
-- WHY: the permission-config sync OVERWRITES values, and the boot-time
-- feature-key migration RENAMES and DELETES rows. A code revert does not undo
-- either. This is the only rollback source for permission data.
--
-- HOW IT WORKS: it copies each table into a `_bak_<date>_<table>` table inside
-- the same database. No files, no terminal, no pg_dump. The copies live in the
-- public schema and are independent rows - nothing the sync does can touch them.
--
-- SAFE TO RUN TWICE. Every statement is CREATE TABLE IF NOT EXISTS, so a second
-- run leaves the original snapshot untouched instead of overwriting it with the
-- post-sync state. That matters: overwriting the backup would destroy the very
-- thing it exists to preserve.
--
-- RUN THIS BEFORE ANY OTHER FILE. Nothing below modifies an existing table.
--
-- TO ROLL BACK LATER (see the recipe at the bottom of this file) you restore
-- from these tables. Keep them until production has been verified for a while,
-- then drop them.
-- =============================================================================


-- =============================================================================
-- 1 - TAKE THE SNAPSHOT
-- =============================================================================
CREATE TABLE IF NOT EXISTS _bak_20260916_feature_eligibility AS SELECT * FROM feature_eligibility;
CREATE TABLE IF NOT EXISTS _bak_20260916_responsibilities AS SELECT * FROM responsibilities;
CREATE TABLE IF NOT EXISTS _bak_20260916_user_responsibilities AS SELECT * FROM user_responsibilities;
CREATE TABLE IF NOT EXISTS _bak_20260916_access_profile_capabilities AS SELECT * FROM access_profile_capabilities;
CREATE TABLE IF NOT EXISTS _bak_20260916_role_access_profile_defaults AS SELECT * FROM role_access_profile_defaults;
CREATE TABLE IF NOT EXISTS _bak_20260916_role_capabilities AS SELECT * FROM role_capabilities;

-- Deliberately NOT snapshotted: venture_staff_assignments. That table does not
-- exist on production yet, so copying it would error. Once
-- migrations/venture_schema_align.sql has created it, it starts empty and there
-- is nothing to preserve.


-- =============================================================================
-- 2 - CONFIRM THE SNAPSHOT. Each pair must be EQUAL, and backup_rows > 0.
-- If any pair differs, or a backup is 0 while the source is not, STOP.
-- =============================================================================
SELECT 'feature_eligibility' AS tbl, (SELECT count(*) FROM feature_eligibility) AS live, (SELECT count(*) FROM _bak_20260916_feature_eligibility) AS backup
UNION ALL SELECT 'responsibilities', (SELECT count(*) FROM responsibilities), (SELECT count(*) FROM _bak_20260916_responsibilities)
UNION ALL SELECT 'user_responsibilities', (SELECT count(*) FROM user_responsibilities), (SELECT count(*) FROM _bak_20260916_user_responsibilities)
UNION ALL SELECT 'access_profile_capabilities', (SELECT count(*) FROM access_profile_capabilities), (SELECT count(*) FROM _bak_20260916_access_profile_capabilities)
UNION ALL SELECT 'role_access_profile_defaults', (SELECT count(*) FROM role_access_profile_defaults), (SELECT count(*) FROM _bak_20260916_role_access_profile_defaults)
UNION ALL SELECT 'role_capabilities', (SELECT count(*) FROM role_capabilities), (SELECT count(*) FROM _bak_20260916_role_capabilities)
ORDER BY 1;


-- =============================================================================
-- 3 - ROLLBACK RECIPE - DO NOT RUN UNLESS YOU MEAN IT
-- =============================================================================
-- Each pair below restores one table to its snapshot. This DELETES the current
-- rows of that table. Only run it if you have decided to abandon the sync.
-- Run one pair at a time, table by table, and check the result after each.
--
-- BEGIN;
--   DELETE FROM feature_eligibility;
--   INSERT INTO feature_eligibility SELECT * FROM _bak_20260916_feature_eligibility;
-- COMMIT;
--
-- BEGIN;
--   DELETE FROM access_profile_capabilities;
--   INSERT INTO access_profile_capabilities SELECT * FROM _bak_20260916_access_profile_capabilities;
-- COMMIT;
--
-- BEGIN;
--   DELETE FROM role_capabilities;
--   INSERT INTO role_capabilities SELECT * FROM _bak_20260916_role_capabilities;
-- COMMIT;
--
-- Note: restoring access_profile_capabilities and role_capabilities by raw
-- INSERT relies on the rows' original ids being re-usable. They are, because
-- nothing in this operation changes them - the sync writes by natural key and
-- the resolver reads by id. If an id collision ever occurs, prefer restoring
-- only the rows that differ, matched on the natural key instead of the id.


-- =============================================================================
-- 4 - CLEAN UP, ONCE PRODUCTION HAS BEEN VERIFIED FOR A WHILE
-- =============================================================================
-- DROP TABLE IF EXISTS _bak_20260916_feature_eligibility;
-- DROP TABLE IF EXISTS _bak_20260916_responsibilities;
-- DROP TABLE IF EXISTS _bak_20260916_user_responsibilities;
-- DROP TABLE IF EXISTS _bak_20260916_access_profile_capabilities;
-- DROP TABLE IF EXISTS _bak_20260916_role_access_profile_defaults;
-- DROP TABLE IF EXISTS _bak_20260916_role_capabilities;
