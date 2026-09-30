-- STAGING DIAGNOSTIC — who can actually act on a Venture, and through which layer?
--
-- Read-only. Run:
--   node scripts/db-audit/run-readonly.mjs scripts/db-audit/venture-authority-check.sql .env.audit-staging

-- 1. The venture-side responsibilities actually assigned on staging.
SELECT a.venture_id, a.responsibility_code, a.scope_type, a.scope_ref_type,
       a.status, c.name AS staff_name, c.email AS staff_email,
       c.access_profile_id, c.group_name
FROM venture_staff_assignments a
LEFT JOIN contacts c ON c.cid = a.staff_contact_id
WHERE a.status = 'active'
ORDER BY a.venture_id, a.responsibility_code;

-- 2. The venture responsibility MATRIX on staging: which cells are TRUE for the
--    attributes the routes actually read.
SELECT responsibility_code, area, action, allowed, updated_by IS NULL AS is_seed_default
FROM venture_permission_matrix
WHERE (area = 'milestones' AND action IN ('view', 'create', 'edit', 'approve'))
   OR (area = 'operating_plan' AND action IN ('view', 'create', 'edit', 'manage'))
   OR (area = 'tasks' AND action IN ('view', 'create', 'edit'))
ORDER BY responsibility_code, area, action;

-- 3. The PLATFORM layer: which access profiles grant ventures.* at all.
SELECT ap.id, ap.name, apc.module, apc.capability, apc.access_level
FROM access_profiles ap
JOIN access_profile_capabilities apc ON apc.profile_id = ap.id
WHERE apc.module = 'ventures'
ORDER BY ap.name, apc.capability;

-- 4. Role-level fallback grants for ventures (used only by profile-less users).
SELECT role, module, capability, access_level
FROM role_capabilities
WHERE module = 'ventures'
ORDER BY role, capability;

-- 5. Per-user grants for ventures — the exceptions.
SELECT uc.user_cid, c.name, uc.module, uc.capability, uc.access_level
FROM user_capabilities uc
LEFT JOIN contacts c ON c.cid = uc.user_cid
WHERE uc.module = 'ventures'
ORDER BY uc.user_cid;

-- 6. Which profile each role falls back to when a user has no explicit profile.
SELECT role_name, access_profile_id
FROM role_access_profile_defaults
ORDER BY role_name;
