-- =============================================================================
-- PHASE 3C-1 — PRODUCTION ACCESS AUDIT — READ ONLY
-- -----------------------------------------------------------------------------
-- Purpose: understand the REAL production permission state before any
-- capability migration. SELECT statements ONLY.
--
-- SAFETY CONFIRMATION:
--   ALL STATEMENTS ARE READ-ONLY. No INSERT / UPDATE / DELETE / ALTER /
--   CREATE / DROP / TRUNCATE / migration / data modification of any kind.
--
-- Run Section 1 FIRST and confirm the database name before reviewing the rest.
-- =============================================================================

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. DATABASE / ENVIRONMENT VERIFICATION
--    Confirm you are connected to the intended PRODUCTION database.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT current_database()        AS db_name,
       current_user              AS db_user,
       inet_server_addr()        AS server_addr,
       inet_server_port()        AS server_port,
       version()                 AS server_version,
       NOW()                     AS checked_at;

-- Baseline row counts for the audit tables (informational).
SELECT 'access_profiles'                  AS tbl, COUNT(*)::bigint AS rows FROM access_profiles
UNION ALL SELECT 'access_profile_capabilities', COUNT(*)::bigint FROM access_profile_capabilities
UNION ALL SELECT 'role_access_profile_defaults', COUNT(*)::bigint FROM role_access_profile_defaults
UNION ALL SELECT 'user_capabilities', COUNT(*)::bigint FROM user_capabilities
UNION ALL SELECT 'user_capability_restrictions', COUNT(*)::bigint FROM user_capability_restrictions
UNION ALL SELECT 'contacts_with_profile', COUNT(*)::bigint FROM contacts WHERE access_profile_id IS NOT NULL
ORDER BY tbl;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. ACCESS PROFILES
-- ═════════════════════════════════════════════════════════════════════════════
SELECT id, name, description, is_active, created_at, updated_at
FROM access_profiles
ORDER BY name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. PROFILE CAPABILITIES (profile → module → capability → access level)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT apc.profile_id,
       ap.name   AS profile_name,
       apc.module,
       apc.capability,
       apc.access_level
FROM access_profile_capabilities apc
JOIN access_profiles ap ON ap.id = apc.profile_id
ORDER BY ap.name, apc.module, apc.capability;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. ROLE → DEFAULT PROFILE MAPPING
--    Includes every role of interest; roles without a mapping row appear with
--    profile_name = NULL (missing mapping).
-- ═════════════════════════════════════════════════════════════════════════════
SELECT roles.role_name,
       rpd.access_profile_id,
       ap.name AS profile_name,
       ap.is_active
FROM (VALUES ('super_admin'), ('staff'), ('program_manager'), ('teacher'),
             ('developer'), ('participant'), ('admin'), ('mentor'), ('investor'))
     AS roles(role_name)
LEFT JOIN role_access_profile_defaults rpd ON rpd.role_name = roles.role_name
LEFT JOIN access_profiles ap ON ap.id = rpd.access_profile_id
ORDER BY roles.role_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. USER PROFILE ASSIGNMENTS (explicit contacts.access_profile_id)
--    No passwords or authentication secrets are exposed.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT c.cid,
       c.name,
       c.email,
       c.role AS global_role,
       c.status,
       c.access_profile_id,
       ap.name AS assigned_profile
FROM contacts c
LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
WHERE c.access_profile_id IS NOT NULL
ORDER BY c.role, c.name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. INDIVIDUAL GRANTS (explicit user-level capability grants)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT uc.user_cid,
       c.name,
       c.email,
       c.role AS global_role,
       uc.module,
       uc.capability,
       uc.access_level,
       uc.granted_by,
       uc.expires_at
FROM user_capabilities uc
LEFT JOIN contacts c ON c.cid = uc.user_cid
WHERE uc.expires_at IS NULL OR uc.expires_at > NOW()
ORDER BY uc.user_cid, uc.module, uc.capability;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. RESTRICTIONS (explicit capability restrictions)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT ucr.user_cid,
       c.name,
       c.email,
       c.role AS global_role,
       ucr.module,
       ucr.capability,
       ucr.restricted_by,
       ucr.expires_at
FROM user_capability_restrictions ucr
LEFT JOIN contacts c ON c.cid = ucr.user_cid
WHERE ucr.expires_at IS NULL OR ucr.expires_at > NOW()
ORDER BY ucr.user_cid, ucr.module, ucr.capability;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. PRODUCTION CAPABILITY GAPS
--    Reports which of the target capability rows EXIST in any profile, and
--    which are MISSING (row_count = 0). Nothing is created.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT t.module,
       t.capability,
       COUNT(apc.id)::int AS profile_rows,
       CASE WHEN COUNT(apc.id) = 0 THEN 'MISSING' ELSE 'PRESENT' END AS status
FROM (VALUES
        ('programs', 'view'), ('programs', 'create'), ('programs', 'edit'),
        ('programs', 'publish'), ('programs', 'delete'),
        ('reports', 'view'), ('reports', 'create'), ('reports', 'export'),
        ('engineering', 'view'), ('engineering', 'manage_tasks'),
        ('finance', 'view'), ('finance', 'create'), ('finance', 'edit'),
        ('finance', 'delete'), ('finance', 'export'),
        ('participants', 'view'), ('participants', 'manage'),
        ('sessions', 'conduct'), ('sessions', 'record'),
        ('assignments', 'view'), ('assignments', 'review'), ('assignments', 'grade'),
        ('kpis', 'view'), ('kpis', 'manage'),
        ('operations', 'view'), ('operations', 'submit')
     ) AS t(module, capability)
LEFT JOIN access_profile_capabilities apc
  ON apc.module = t.module AND apc.capability = t.capability
GROUP BY t.module, t.capability
ORDER BY status DESC, t.module, t.capability;

-- Detail: which profiles hold each PRESENT target capability (drill-down).
SELECT apc.profile_id, ap.name AS profile_name, apc.module, apc.capability, apc.access_level
FROM access_profile_capabilities apc
JOIN access_profiles ap ON ap.id = apc.profile_id
WHERE (apc.module, apc.capability) IN (
        ('programs','view'), ('programs','create'), ('programs','edit'),
        ('programs','publish'), ('programs','delete'),
        ('reports','view'), ('reports','create'), ('reports','export'),
        ('engineering','view'), ('engineering','manage_tasks'),
        ('finance','view'), ('finance','create'), ('finance','edit'),
        ('finance','delete'), ('finance','export'),
        ('participants','view'), ('participants','manage'),
        ('sessions','conduct'), ('sessions','record'),
        ('assignments','view'), ('assignments','review'), ('assignments','grade'),
        ('kpis','view'), ('kpis','manage'),
        ('operations','view'), ('operations','submit')
      )
ORDER BY ap.name, apc.module, apc.capability;

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. STAFF IMPACT ANALYSIS
--    Identifies Staff users with program-management responsibilities today,
--    i.e. candidates for Program Manager capabilities after the legacy bypass
--    is removed. No access is changed.
-- ═════════════════════════════════════════════════════════════════════════════

-- 9a. Staff who are assigned_pm_id on one or more programs
SELECT 'assigned_pm' AS evidence, c.cid, c.name, c.email, c.role,
       c.access_profile_id, ap.name AS assigned_profile,
       COUNT(p.id)::int AS program_count
FROM contacts c
JOIN v2_programs p ON p.assigned_pm_id = c.cid
LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
WHERE c.role = 'staff'
GROUP BY c.cid, c.name, c.email, c.role, c.access_profile_id, ap.name
ORDER BY program_count DESC;

-- 9b. Staff with program-staff assignment rows (any program role)
SELECT 'program_staff' AS evidence, c.cid, c.name, c.email, c.role,
       c.access_profile_id, ap.name AS assigned_profile,
       ps.role AS program_role, COUNT(*)::int AS assignment_count
FROM v2_program_staff ps
JOIN contacts c ON c.cid = ps.staff_id
LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
WHERE c.role = 'staff'
GROUP BY c.cid, c.name, c.email, c.role, c.access_profile_id, ap.name, ps.role
ORDER BY c.name, program_role;

-- 9c. Staff with explicit capabilities granted (any module)
SELECT 'explicit_grant' AS evidence, c.cid, c.name, c.email, c.role,
       uc.module, uc.capability, uc.access_level
FROM user_capabilities uc
JOIN contacts c ON c.cid = uc.user_cid
WHERE c.role = 'staff'
  AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
ORDER BY c.name, uc.module, uc.capability;

-- 9d. Staff with responsibilities assigned
SELECT 'responsibility' AS evidence, c.cid, c.name, c.email, c.role,
       r.name AS responsibility, r.key AS responsibility_key
FROM user_responsibilities ur
JOIN responsibilities r ON r.id = ur.responsibility_id
JOIN contacts c ON c.cid = ur.user_cid
WHERE c.role = 'staff'
ORDER BY c.name, r.name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. SUMMARY COUNTS
-- ═════════════════════════════════════════════════════════════════════════════
SELECT 'total_access_profiles'                  AS metric, COUNT(*)::bigint AS value FROM access_profiles
UNION ALL SELECT 'total_profile_capability_rows', COUNT(*)::bigint FROM access_profile_capabilities
UNION ALL SELECT 'total_role_profile_defaults', COUNT(*)::bigint FROM role_access_profile_defaults
UNION ALL SELECT 'total_users_with_explicit_profile', COUNT(*)::bigint FROM contacts WHERE access_profile_id IS NOT NULL
UNION ALL SELECT 'total_individual_grants_active', COUNT(*)::bigint FROM user_capabilities WHERE expires_at IS NULL OR expires_at > NOW()
UNION ALL SELECT 'total_restrictions_active', COUNT(*)::bigint FROM user_capability_restrictions WHERE expires_at IS NULL OR expires_at > NOW()
UNION ALL SELECT 'staff_with_pm_assignment', COUNT(DISTINCT c.cid)::bigint
  FROM contacts c JOIN v2_programs p ON p.assigned_pm_id = c.cid WHERE c.role = 'staff'
UNION ALL SELECT 'staff_with_program_staff_rows', COUNT(DISTINCT c.cid)::bigint
  FROM contacts c JOIN v2_program_staff ps ON ps.staff_id = c.cid WHERE c.role = 'staff'
UNION ALL SELECT 'staff_with_explicit_grants', COUNT(DISTINCT c.cid)::bigint
  FROM contacts c JOIN user_capabilities uc ON uc.user_cid = c.cid
  WHERE c.role = 'staff' AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
UNION ALL SELECT 'missing_target_capabilities', COUNT(*)::bigint
  FROM (VALUES ('programs','view'),('programs','create'),('programs','edit'),
               ('programs','publish'),('programs','delete'),
               ('reports','view'),('reports','create'),('reports','export'),
               ('engineering','view'),('engineering','manage_tasks'),
               ('participants','view'),('participants','manage'),
               ('sessions','conduct'),('sessions','record'),
               ('assignments','view'),('assignments','review'),('assignments','grade'),
               ('kpis','view'),('kpis','manage'),
               ('operations','view'),('operations','submit')) AS t(module, capability)
  LEFT JOIN access_profile_capabilities apc
    ON apc.module = t.module AND apc.capability = t.capability
  WHERE apc.id IS NULL
ORDER BY metric;
