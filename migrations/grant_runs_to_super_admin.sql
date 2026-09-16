-- =============================================================================
-- GRANT runs.view + runs.edit TO THE SUPER ADMIN TEMPLATE
-- =============================================================================
-- WHY, GIVEN SUPER ADMIN ALREADY WORKS
--   It does work, and it will keep working: resolveAuthorizationContext returns
--   before any profile lookup for role = 'super_admin', and buildSuperAdminMatrix()
--   fills every module's every capability at ACCESS_LEVELS.FULL in code. So this
--   file changes NOBODY's access today.
--
--   It exists because that grant is invisible. Measured on both databases, the
--   `Super Admin Default` profile carries 88 capabilities and NOT ONE `runs` row,
--   so an administrator looking at the Permission Center sees a Super Admin
--   template that appears unable to touch Runs. Storing the rows makes the
--   template self-sufficient and readable:
--     - the matrix shows the capability instead of a blank cell;
--     - if a non-super_admin contact is ever assigned this template by override,
--       they get the Runs write actions from the row rather than from nothing.
--
-- WHY IT IS SAFE
--   * INSERT ... WHERE NOT EXISTS only. An existing row is left EXACTLY as it is,
--     at EXACTLY the level an administrator set — never upgraded or downgraded.
--   * No other module, no other profile, no other table is touched.
--   * Level 3 = edit, level 1 = view, following the catalog convention
--     (view 1, create 2, edit 3, delete 4).
--   * Safe to re-run: the second run inserts nothing.
--
-- RUN IT
--   node scripts/db-audit/apply-schema-file.mjs migrations/grant_runs_to_super_admin.sql
--   node scripts/db-audit/apply-schema-file.mjs migrations/grant_runs_to_super_admin.sql --apply .env.local
--   node scripts/db-audit/apply-schema-file.mjs migrations/grant_runs_to_super_admin.sql --apply .env.audit-staging
--   Then confirm with migrations/check_runs_edit_holders.sql (Q7: expect 2 rows).
-- =============================================================================

INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level) SELECT ap.id, 'runs', 'edit', 3 FROM access_profiles ap WHERE ap.name = 'Super Admin Default' AND ap.is_active = 1 AND NOT EXISTS (SELECT 1 FROM access_profile_capabilities c WHERE c.profile_id = ap.id AND c.module = 'runs' AND c.capability = 'edit');

INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level) SELECT ap.id, 'runs', 'view', 1 FROM access_profiles ap WHERE ap.name = 'Super Admin Default' AND ap.is_active = 1 AND NOT EXISTS (SELECT 1 FROM access_profile_capabilities c WHERE c.profile_id = ap.id AND c.module = 'runs' AND c.capability = 'view');
