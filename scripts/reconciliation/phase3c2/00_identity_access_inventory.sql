-- =============================================================================
-- PHASE 3C-2 — COMPLETE PRODUCTION IDENTITY / ACCESS INVENTORY — READ ONLY
-- -----------------------------------------------------------------------------
-- Purpose: map EVERY active user's current access BEFORE any 3C migration.
--   Covers: all Staff, all Super Admins, and every other elevated/contextual
--   user (PM, facilitator, teacher, developer, finance, venture, intern).
--
--   We deliberately do NOT assume "the Staff member with assigned_pm_id is
--   the only migration target". Every Staff and Super Admin must be inventoried
--   to determine what they currently do and what access they should retain.
--
-- SAFETY CONFIRMATION:
--   ALL STATEMENTS ARE READ-ONLY. No INSERT / UPDATE / DELETE / ALTER /
--   CREATE / DROP / TRUNCATE / migration / data modification of any kind.
--
-- Run Section 0 FIRST and confirm the database name before reviewing the rest.
-- =============================================================================

-- ═════════════════════════════════════════════════════════════════════════════
-- 0. DATABASE / ENVIRONMENT VERIFICATION
--    Confirm you are connected to the intended PRODUCTION database.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT current_database()        AS db_name,
       current_user              AS db_user,
       inet_server_addr()        AS server_addr,
       inet_server_port()        AS server_port,
       version()                 AS server_version,
       NOW()                     AS checked_at;

-- Baseline contact counts by role (informational; only active, non-deleted).
SELECT role, COUNT(*)::int AS contacts
FROM contacts
WHERE deleted = 0 AND (deleted_at IS NULL OR deleted_at IS NULL)
  AND (archived_at IS NULL OR archived_at IS NULL)
GROUP BY role
ORDER BY role;

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. MASTER IDENTITY LIST — every active user
--    One row per person. This is the universe for the access map.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT c.cid,
       c.name,
       c.email,
       c.role            AS global_role,
       c.status,
       c.access_profile_id,
       ap.name           AS assigned_profile,
       c.group_name      AS legacy_group,
       c.created_at
FROM contacts c
LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
WHERE c.deleted = 0
  AND (c.archived_at IS NULL OR c.archived_at IS NULL)
ORDER BY c.role, c.name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. ACCESS PROFILE SOURCE — explicit override vs role default vs legacy
--    Shows which profile the capability engine actually resolves for each user
--    (explicit contacts.access_profile_id wins over role_access_profile_defaults;
--    if neither, the engine falls back to legacy role_capabilities).
-- ═════════════════════════════════════════════════════════════════════════════
SELECT c.cid,
       c.name,
       c.role AS global_role,
       c.access_profile_id                                   AS explicit_profile_id,
       ap_explicit.name                                      AS explicit_profile,
       rpd.access_profile_id                                 AS role_default_profile_id,
       ap_role.name                                          AS role_default_profile,
       CASE
         WHEN c.access_profile_id IS NOT NULL THEN 'user (explicit override)'
         WHEN rpd.access_profile_id IS NOT NULL THEN 'role (default mapping)'
         ELSE 'legacy (role_capabilities fallback)'
       END                                                   AS effective_source
FROM contacts c
LEFT JOIN access_profiles ap_explicit ON ap_explicit.id = c.access_profile_id
LEFT JOIN role_access_profile_defaults rpd ON rpd.role_name = c.role
LEFT JOIN access_profiles ap_role ON ap_role.id = rpd.access_profile_id
WHERE c.deleted = 0
  AND (c.archived_at IS NULL OR c.archived_at IS NULL)
ORDER BY c.role, c.name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. INDIVIDUAL GRANTS — every active user-level capability grant
--    Super Admins are included: explicit grants REPLACE the default SA bypass
--    for that capability, so they can limit as well as extend.
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
WHERE (uc.expires_at IS NULL OR uc.expires_at > NOW())
  AND c.deleted = 0
ORDER BY uc.user_cid, uc.module, uc.capability;

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. RESTRICTIONS — every active user-level capability restriction
--    Restrictions win over profiles AND grants in the engine.
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
WHERE (ucr.expires_at IS NULL OR ucr.expires_at > NOW())
  AND c.deleted = 0
ORDER BY ucr.user_cid, ucr.module, ucr.capability;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. RESPONSIBILITIES — every user -> responsibility assignment
--    Responsibilities signal ownership/dashboard/nav context; they do NOT
--    grant capabilities by themselves.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT ur.user_cid,
       c.name,
       c.email,
       c.role AS global_role,
       r.key   AS responsibility_key,
       r.name  AS responsibility_name
FROM user_responsibilities ur
JOIN responsibilities r ON r.id = ur.responsibility_id
JOIN contacts c ON c.cid = ur.user_cid
WHERE r.is_active = 1
  AND c.deleted = 0
ORDER BY ur.user_cid, r.name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. PROGRAM CONTEXTS — v2_program_staff rows (facilitator / staff / other)
--    One row per person-program-role. Includes the assignment permission map
--    for facilitators (program default / individual overrides).
-- ═════════════════════════════════════════════════════════════════════════════
SELECT ps.staff_id        AS cid,
       c.name,
       c.email,
       c.role             AS global_role,
       CAST(ps.program_id AS TEXT) AS program_id,
       p.name             AS program_name,
       p.status           AS program_status,
       ps.role            AS program_role,
       ps.permissions
FROM v2_program_staff ps
JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
LEFT JOIN contacts c ON c.cid = ps.staff_id OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id))
WHERE c.deleted = 0
ORDER BY c.name, p.name, ps.role;

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. PROGRAM CONTEXTS — assigned Program Manager (v2_programs.assigned_pm_id)
--    One row per program; the PM context of each assigned person.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT p.assigned_pm_id AS cid,
       c.name,
       c.email,
       c.role AS global_role,
       p.id::text AS program_id,
       p.name   AS program_name,
       p.status AS program_status,
       p.assigned_assistant_id
FROM v2_programs p
LEFT JOIN contacts c ON c.cid = p.assigned_pm_id
WHERE p.assigned_pm_id IS NOT NULL
ORDER BY c.name, p.name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 8. PROGRAM CONTEXTS — participant memberships (participant_programs)
--    Includes completed/enrolled history: completed programs must remain
--    visible as history; status columns distinguish current vs historical.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT pp.participant_id AS cid,
       c.name,
       c.email,
       c.role AS global_role,
       CAST(pp.program_id AS TEXT) AS program_id,
       p.name  AS program_name,
       p.status AS program_status,
       pp.status,           -- participant_programs.status
       pp.screening_status,
       pp.accepted_at,
       pp.completed_at,
       pp.outcome,
       pp.certificate_issued,
       pp.assigned_at
FROM participant_programs pp
JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
LEFT JOIN contacts c ON c.cid = pp.participant_id
WHERE c.deleted = 0
ORDER BY c.name, p.name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 9. VENTURE CONTEXTS — venture_members (current memberships only)
-- ═════════════════════════════════════════════════════════════════════════════
SELECT vm.contact_id AS cid,
       c.name,
       c.email,
       c.role AS global_role,
       vm.venture_id,
       COALESCE(v.company_name, v.name) AS venture_name,
       v.status AS venture_status,
       vm.role AS venture_role,
       vm.joined_at
FROM venture_members vm
LEFT JOIN ventures v ON v.venture_id = vm.venture_id
LEFT JOIN contacts c ON c.cid = vm.contact_id
WHERE vm.removed_at IS NULL
  AND c.deleted = 0
ORDER BY c.name, venture_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 10. CONTEXTUAL RELATIONSHIPS — contact_roles (all context types)
--     Includes: program titles, supervision (supervisor), venture/form roles.
--     This is the generalized contextual table read by the workspaces resolver.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT cr.contact_cid AS cid,
       c.name,
       c.email,
       c.role AS global_role,
       cr.context_type,
       cr.context_id,
       cr.role,
       cr.title,
       cr.is_current,
       cr.status,
       cr.scope,
       cr.capability_overrides,
       cr.started_at,
       cr.ended_at,
       cr.assigned_by
FROM contact_roles cr
LEFT JOIN contacts c ON c.cid = cr.contact_cid
WHERE c.deleted = 0
ORDER BY c.name, cr.context_type, cr.started_at DESC;

-- ═════════════════════════════════════════════════════════════════════════════
-- 11. USER GROUPS — group membership per user
--     Group capabilities (group_capabilities) feed the engine as a second
--     capability source (merged with profile + grants).
-- ═════════════════════════════════════════════════════════════════════════════
SELECT ug.user_cid AS cid,
       c.name,
       c.email,
       c.role AS global_role,
       ug.group_name,
       ug.role_in_group
FROM user_groups ug
LEFT JOIN contacts c ON c.cid = ug.user_cid
WHERE c.deleted = 0
ORDER BY c.name, ug.group_name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 12. CONSOLIDATED ACCESS MAP — ONE ROW PER PERSON
--     This is the master table for the 3C migration decision:
--       Person | Global Role | Profile (source) | Responsibilities |
--       Contexts | Grants | Restrictions | Legacy-only flag
--     "Current access" = legacy role allowlists (requireAuth) + effective
--     capabilities (profile ∪ groups ∪ grants ∖ restrictions). The effective
--     capability detail is available per user in Section 3 of the 3C-1 audit.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT c.cid,
       c.name,
       c.email,
       c.role                                                AS global_role,
       c.status,
       COALESCE(ap_explicit.name, ap_role.name)              AS effective_profile,
       CASE
         WHEN c.access_profile_id IS NOT NULL THEN 'user'
         WHEN ap_role.id IS NOT NULL THEN 'role'
         ELSE 'legacy'
       END                                                   AS profile_source,
       resp.responsibilities,
       prog_staff.program_roles,
       pm.pm_programs,
       parts.participant_programs,
       vents.ventures,
       sup.supervisor_cid,
       grants.grants,
       restr.restrictions,
       (c.access_profile_id IS NULL AND grants.grants IS NULL) AS legacy_only
FROM contacts c
LEFT JOIN access_profiles ap_explicit ON ap_explicit.id = c.access_profile_id
LEFT JOIN role_access_profile_defaults rpd ON rpd.role_name = c.role
LEFT JOIN access_profiles ap_role ON ap_role.id = rpd.access_profile_id

LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT r.name, ', ' ORDER BY r.name) AS responsibilities
  FROM user_responsibilities ur
  JOIN responsibilities r ON r.id = ur.responsibility_id
  WHERE ur.user_cid = c.cid AND r.is_active = 1
) resp ON true

LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT ps.role || ' @ ' || p.name, ', ' ORDER BY ps.role) AS program_roles
  FROM v2_program_staff ps
  JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
  WHERE (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
) prog_staff ON true

LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT 'PM @ ' || p.name, ', ' ORDER BY p.name) AS pm_programs
  FROM v2_programs p
  WHERE p.assigned_pm_id = c.cid
) pm ON true

LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT 'Participant @ ' || p.name || COALESCE(' (' || pp.status || ')', ''), ', ' ORDER BY p.name) AS participant_programs
  FROM participant_programs pp
  JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
  WHERE pp.participant_id = c.cid
) parts ON true

LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT 'Member @ ' || COALESCE(v.company_name, v.name), ', ' ORDER BY v.company_name) AS ventures
  FROM venture_members vm
  LEFT JOIN ventures v ON v.venture_id = vm.venture_id
  WHERE vm.contact_id = c.cid AND vm.removed_at IS NULL
) vents ON true

LEFT JOIN LATERAL (
  SELECT context_id AS supervisor_cid
  FROM contact_roles
  WHERE contact_cid = c.cid AND context_type = 'supervision' AND is_current = true
  ORDER BY started_at DESC
  LIMIT 1
) sup ON true

LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT uc.module || '.' || uc.capability || '@' || uc.access_level, ', ' ORDER BY uc.module) AS grants
  FROM user_capabilities uc
  WHERE uc.user_cid = c.cid AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
) grants ON true

LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT ucr.module || '.' || ucr.capability, ', ' ORDER BY ucr.module) AS restrictions
  FROM user_capability_restrictions ucr
  WHERE ucr.user_cid = c.cid AND (ucr.expires_at IS NULL OR ucr.expires_at > NOW())
) restr ON true

WHERE c.deleted = 0
  AND (c.archived_at IS NULL OR c.archived_at IS NULL)
ORDER BY c.role, c.name;

-- ═════════════════════════════════════════════════════════════════════════════
-- 13. SUMMARY COUNTS
-- ═════════════════════════════════════════════════════════════════════════════
SELECT 'active_users'                     AS metric, COUNT(*)::bigint AS value
  FROM contacts WHERE deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'staff_users', COUNT(*)::bigint
  FROM contacts WHERE role = 'staff' AND deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'super_admin_users', COUNT(*)::bigint
  FROM contacts WHERE role = 'super_admin' AND deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'users_with_explicit_profile', COUNT(*)::bigint
  FROM contacts WHERE access_profile_id IS NOT NULL AND deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'users_with_individual_grants', COUNT(DISTINCT user_cid)::bigint
  FROM user_capabilities WHERE expires_at IS NULL OR expires_at > NOW()
UNION ALL SELECT 'users_with_restrictions', COUNT(DISTINCT user_cid)::bigint
  FROM user_capability_restrictions WHERE expires_at IS NULL OR expires_at > NOW()
UNION ALL SELECT 'users_with_responsibilities', COUNT(DISTINCT user_cid)::bigint
  FROM user_responsibilities ur JOIN responsibilities r ON r.id = ur.responsibility_id WHERE r.is_active = 1
UNION ALL SELECT 'users_with_program_staff_rows', COUNT(DISTINCT ps.staff_id)::bigint
  FROM v2_program_staff ps
UNION ALL SELECT 'users_with_pm_assignment', COUNT(DISTINCT assigned_pm_id)::bigint
  FROM v2_programs WHERE assigned_pm_id IS NOT NULL
UNION ALL SELECT 'users_with_participant_memberships', COUNT(DISTINCT participant_id)::bigint
  FROM participant_programs
UNION ALL SELECT 'users_with_venture_memberships', COUNT(DISTINCT contact_id)::bigint
  FROM venture_members WHERE removed_at IS NULL
UNION ALL SELECT 'users_with_supervision_relationships', COUNT(DISTINCT contact_cid)::bigint
  FROM contact_roles WHERE context_type = 'supervision' AND is_current = true
UNION ALL SELECT 'users_with_user_groups', COUNT(DISTINCT user_cid)::bigint
  FROM user_groups
UNION ALL SELECT 'legacy_only_users_no_profile_no_grants', COUNT(*)::bigint
  FROM contacts c
  WHERE c.deleted = 0 AND (c.archived_at IS NULL OR c.archived_at IS NULL)
    AND c.access_profile_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM user_capabilities uc WHERE uc.user_cid = c.cid AND (uc.expires_at IS NULL OR uc.expires_at > NOW()))
ORDER BY metric;
