-- =============================================================================
-- VERIFY THE PERMISSION CONFIG SYNC - staging vs production
-- =============================================================================
-- Run the SAME file against both databases and compare the output:
--
--   node scripts/db-audit/run-readonly.mjs migrations/verify_permission_config_sync.sql .env.audit-staging
--   node scripts/db-audit/run-readonly.mjs migrations/verify_permission_config_sync.sql .env.local
--
-- READ-ONLY. Every statement is a SELECT; scripts/db-audit/run-readonly.mjs
-- refuses anything that is not SELECT/WITH/SET/SHOW/EXPLAIN/VALUES, so this file
-- cannot change either database.
--
-- EVERY STATEMENT IS INDEPENDENT (one SELECT per line, no UNION ALL). That is
-- deliberate: production is still missing several tables, and a UNION ALL would
-- make ONE missing relation abort the whole block and return no counts at all.
-- One statement failing here costs you exactly that one number.
--
-- NOTE ON THE CONNECTION LINE: staging and production both report the same
-- pooled Supabase host, database and user, so the printed `=== CONNECTED ===`
-- line cannot tell them apart. The only discriminator is the env-file argument
-- you passed. Keep the two outputs labelled by the command you ran.
--
-- WHAT TO EXPECT, so a correct result is not mistaken for a problem:
--   * S1 must CONVERGE on the tables the sync covers, but it will NOT equalise
--     everywhere: the sync is an UPSERT, so it can add and overwrite but it can
--     NEVER remove. Where production already holds rows staging does not, those
--     rows survive and production stays a superset. S11 and S12 dump those two
--     tables in full precisely so the extras can be diffed and judged.
--   * S2 MUST NOT MATCH. Staging holds per-user rows and ~24 authz_migrations
--     markers; production must keep its own. A diff here is the PROOF the
--     exclusions held.
--   * A missing relation is a real answer: run migrations/venture_schema_align.sql
--     BEFORE this file, because the schema comes before the config.
-- =============================================================================


-- =============================================================================
-- S1 - CONFIGURATION COUNTS. These must MATCH once the sync has been applied.
-- =============================================================================
SELECT 'S1.01 access_profiles (active)' AS section, count(*)::text AS n FROM access_profiles WHERE is_active = 1;
SELECT 'S1.02 access_profiles (all)' AS section, count(*)::text AS n FROM access_profiles;
SELECT 'S1.03 access_profile_capabilities (active profiles)' AS section, count(*)::text AS n FROM access_profile_capabilities WHERE profile_id IN (SELECT id FROM access_profiles WHERE is_active = 1);
SELECT 'S1.04 access_profile_capabilities (all)' AS section, count(*)::text AS n FROM access_profile_capabilities;
SELECT 'S1.05 role_access_profile_defaults' AS section, count(*)::text AS n FROM role_access_profile_defaults;
SELECT 'S1.06 role_capabilities' AS section, count(*)::text AS n FROM role_capabilities;
SELECT 'S1.07 feature_eligibility' AS section, count(*)::text AS n FROM feature_eligibility;
SELECT 'S1.08 responsibilities' AS section, count(*)::text AS n FROM responsibilities;
SELECT 'S1.09 context_role_profiles' AS section, count(*)::text AS n FROM context_role_profiles;
SELECT 'S1.10 venture_permission_matrix' AS section, count(*)::text AS n FROM venture_permission_matrix;
SELECT 'S1.11 venture_responsibilities' AS section, count(*)::text AS n FROM venture_responsibilities;
SELECT 'S1.12 venture_scope_types' AS section, count(*)::text AS n FROM venture_scope_types;


-- =============================================================================
-- S2 - THE EXCLUSIONS. These must NOT match. This is the safety proof: staging's
-- per-user rows and its migration markers stayed on staging.
-- =============================================================================
SELECT 'S2.01 user_capabilities' AS tbl, count(*)::text AS n FROM user_capabilities;
SELECT 'S2.02 user_capability_restrictions' AS tbl, count(*)::text AS n FROM user_capability_restrictions;
SELECT 'S2.03 user_responsibilities' AS tbl, count(*)::text AS n FROM user_responsibilities;
SELECT 'S2.04 context_applied_grants' AS tbl, count(*)::text AS n FROM context_applied_grants;
SELECT 'S2.05 group_memberships' AS tbl, count(*)::text AS n FROM group_memberships;
SELECT 'S2.06 user_groups' AS tbl, count(*)::text AS n FROM user_groups;
SELECT 'S2.07 authz_migrations' AS tbl, count(*)::text AS n FROM authz_migrations;
SELECT 'S2.08 contacts' AS tbl, count(*)::text AS n FROM contacts;


-- =============================================================================
-- S3 - THE CAPABILITIES THAT DECIDE WHETHER THE SEND-MESSAGE BUG IS FIXED.
-- ABSENT is a real answer, not an error: it means nobody holds it.
-- NOTE: staging does NOT hold runs.edit either, so the sync cannot deliver it.
-- Only migrations/grant_runs_edit.sql does. Expect ABSENT here on BOTH
-- databases until that third file has run.
-- =============================================================================
SELECT 'S3.01 profile Program Manager / runs.edit' AS probe, coalesce(max(c.access_level)::text, 'ABSENT') AS value FROM access_profile_capabilities c WHERE c.profile_id IN (SELECT id FROM access_profiles WHERE name = 'Program Manager') AND c.module = 'runs' AND c.capability = 'edit';
SELECT 'S3.02 profile Program Manager / runs.review' AS probe, coalesce(max(c.access_level)::text, 'ABSENT') AS value FROM access_profile_capabilities c WHERE c.profile_id IN (SELECT id FROM access_profiles WHERE name = 'Program Manager') AND c.module = 'runs' AND c.capability = 'review';
SELECT 'S3.03 profile Program Manager / runs.create' AS probe, coalesce(max(c.access_level)::text, 'ABSENT') AS value FROM access_profile_capabilities c WHERE c.profile_id IN (SELECT id FROM access_profiles WHERE name = 'Program Manager') AND c.module = 'runs' AND c.capability = 'create';
SELECT 'S3.04 profile Program Manager / lms.view' AS probe, coalesce(max(c.access_level)::text, 'ABSENT') AS value FROM access_profile_capabilities c WHERE c.profile_id IN (SELECT id FROM access_profiles WHERE name = 'Program Manager') AND c.module = 'lms' AND c.capability = 'view';
SELECT 'S3.05 profile Program Manager / lms.edit' AS probe, coalesce(max(c.access_level)::text, 'ABSENT') AS value FROM access_profile_capabilities c WHERE c.profile_id IN (SELECT id FROM access_profiles WHERE name = 'Program Manager') AND c.module = 'lms' AND c.capability = 'edit';
SELECT 'S3.06 role program_manager / runs.edit' AS probe, coalesce(max(access_level)::text, 'ABSENT') AS value FROM role_capabilities WHERE role = 'program_manager' AND module = 'runs' AND capability = 'edit';


-- =============================================================================
-- S4 - THE FEATURES PRODUCTION CURRENTLY HAS NOTHING FOR.
-- Production had 0 rows for lms and 0 for investors before the sync.
-- =============================================================================
SELECT feature_key, count(*)::text AS n FROM feature_eligibility WHERE feature_key IN ('lms', 'investors') GROUP BY feature_key ORDER BY 1;


-- =============================================================================
-- S5 - ACTIVE PROFILE NAMES. A diff is the visible change: production should
-- gain Founder and learner. Any profile staging does not have is left alone.
-- =============================================================================
SELECT name, is_active FROM access_profiles ORDER BY name;


-- =============================================================================
-- S6 - THE COACH CELL AND ITS updated_by.
-- The boot-time correction (PRODUCTION_TEST.md section 5) only applies where
-- updated_by IS NULL. Check the coach/calendar/schedule cell on BOTH databases
-- after the sync: if staging delivers updated_by = NULL, the correction applies;
-- if any cell arrives pre-marked, the correction deliberately skips it.
-- =============================================================================
SELECT responsibility_code, area, action, allowed, updated_by FROM venture_permission_matrix WHERE area = 'calendar' ORDER BY responsibility_code;


-- =============================================================================
-- S7 - THE RESPONSIBILITY CATALOGUE. Staging carries both sides of the renames
-- (investor + investors, knowledge + knowledge_base, program_management +
-- programs, reporting + reports, system_settings + settings), so expect the
-- same pairs on production after the sync.
-- =============================================================================
SELECT key, name, is_active FROM responsibilities ORDER BY key;


-- =============================================================================
-- S8 - ROLE DEFAULTS, with each role's profile resolved.
-- A NULL profile means the role resolves through role_capabilities instead.
-- Note staging maps investor + mentor to 'Mentor' while production uses
-- 'Investor Access', so the sync CHANGES those two mappings on purpose.
-- =============================================================================
SELECT rpd.role_name, ap.name AS profile, ap.is_active FROM role_access_profile_defaults rpd LEFT JOIN access_profiles ap ON ap.id = rpd.access_profile_id ORDER BY rpd.role_name;


-- =============================================================================
-- S9 - CONTEXT ROLE PROFILES, resolved. A NULL profile here is deliberate on
-- staging for investor/investor and program/facilitator.
-- =============================================================================
SELECT crp.context, crp.role_key, ap.name AS profile, crp.is_active FROM context_role_profiles crp LEFT JOIN access_profiles ap ON ap.id = crp.profile_id ORDER BY crp.context, crp.role_key;


-- =============================================================================
-- S10 - SANITY: nobody gained a personal capability by accident.
-- These are per-user rows and the sync must not have touched them. Staging has
-- ten of these (contacts x 6, runs x 4); none of them may travel.
-- =============================================================================
SELECT module, capability, count(*)::text AS holders FROM user_capabilities GROUP BY module, capability ORDER BY module, capability;


-- =============================================================================
-- S11 - `role_capabilities` IN FULL. Diff the two outputs: the sync UPSERTS, so
-- any row production holds that staging does not will SURVIVE. Production ran
-- 106 rows against staging's 45 on the first run, so expect extras here — most
-- likely retired capabilities (lms.publish / enroll / assign) that staging had
-- removed. Read the diff and decide per row; nothing can delete them for you.
-- =============================================================================
SELECT role, module, capability, access_level FROM role_capabilities ORDER BY role, module, capability;


-- =============================================================================
-- S12 - `feature_eligibility` IN FULL. Same reasoning, and this one carries more
-- risk than S11: an eligibility row production holds alone means a role is
-- eligible for a feature staging does not allow. Production ran 64 rows against
-- staging's 56. Diff these two lists and decide each extra deliberately.
-- =============================================================================
SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility ORDER BY feature_key, identity_type, identity_value;
