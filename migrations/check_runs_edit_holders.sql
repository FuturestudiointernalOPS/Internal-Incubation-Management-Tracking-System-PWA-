-- =============================================================================
-- READ-ONLY — who can write to Communication → Runs?
-- =============================================================================
-- Every Runs write action is gated on `runs.edit` (send_manual_message,
-- send_result_emails, send_activation_messages, retry_emails,
-- mark_email_cancelled, manual_add, assign, unassign, regenerate_link, PUT run
-- metadata). This prints every holder, so "does Super Admin have it too?" is
-- answered from the database rather than assumed.
--
--   node scripts/db-audit/run-readonly.mjs migrations/check_runs_edit_holders.sql .env.local
--   node scripts/db-audit/run-readonly.mjs migrations/check_runs_edit_holders.sql .env.audit-staging
-- =============================================================================

-- Q7. THE DIRECT ANSWER. Does the Super Admin Default profile hold runs.edit?
-- A row with access_level 3 is yes. Zero rows means Super Admin relies on the
-- engine's bypass instead (see Q5 note).
SELECT ap.name AS profile, c.module, c.capability, c.access_level FROM access_profile_capabilities c JOIN access_profiles ap ON ap.id = c.profile_id WHERE ap.name = 'Super Admin Default' AND c.module = 'runs' ORDER BY c.capability;

-- Q1. Every `runs` capability held via a profile — all holders, all levels.
SELECT ap.name AS profile, ap.is_active, c.capability, c.access_level FROM access_profile_capabilities c JOIN access_profiles ap ON ap.id = c.profile_id WHERE c.module = 'runs' ORDER BY c.capability, ap.name;

-- Q2. Every `runs` capability held via the role_capabilities fallback. The
-- fallback only applies to a role with NO resolvable profile.
SELECT role, module, capability, access_level FROM role_capabilities WHERE module = 'runs' ORDER BY role, capability;

-- Q3. Who resolves to which profile — the map the resolver reads first.
SELECT r.role_name, r.access_profile_id, ap.name AS profile, ap.is_active FROM role_access_profile_defaults r LEFT JOIN access_profiles ap ON ap.id = r.access_profile_id ORDER BY r.role_name;

-- Q4. Do all three Supervisor-Admin-ish names exist, and is the one that
-- matters active? An inactive profile falls through to role_capabilities.
SELECT id, name, description, is_active FROM access_profiles WHERE name ILIKE '%super admin%' OR name ILIKE '%superadmin%' ORDER BY id;

-- Q5. Total capabilities each candidate template carries, for context.
SELECT ap.name, ap.is_active, count(c.id) AS caps FROM access_profiles ap LEFT JOIN access_profile_capabilities c ON c.profile_id = ap.id WHERE ap.name IN ('Super Admin Default', 'Program Manager', 'Staff Default') GROUP BY ap.name, ap.is_active ORDER BY ap.name;
