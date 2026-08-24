-- =============================================================================
-- PHASE 3C-2 — ELEVATED ACCESS MAP (staff / super_admin / facilitators / others)
-- READ ONLY — SELECT statements only. Same safety rules as the full inventory.
-- Covers every NON-participant contact: this is the 3C migration universe.
-- =============================================================================

-- ── A. ELEVATED CONTACTS + PROFILE SOURCE ────────────────────────────────────
SELECT c.cid, c.name, c.email, c.role AS global_role, c.status,
       c.access_profile_id AS explicit_profile_id,
       ap_explicit.name AS explicit_profile,
       ap_role.name AS role_default_profile,
       CASE
         WHEN c.access_profile_id IS NOT NULL THEN 'user'
         WHEN ap_role.id IS NOT NULL THEN 'role'
         ELSE 'legacy'
       END AS profile_source
FROM contacts c
LEFT JOIN access_profiles ap_explicit ON ap_explicit.id = c.access_profile_id
LEFT JOIN role_access_profile_defaults rpd ON rpd.role_name = c.role
LEFT JOIN access_profiles ap_role ON ap_role.id = rpd.access_profile_id
WHERE c.deleted = 0 AND c.role <> 'participant'
ORDER BY c.role, c.name;

-- ── B. INDIVIDUAL GRANTS (all users, active) ─────────────────────────────────
SELECT uc.user_cid, c.name, c.role AS global_role, uc.module, uc.capability,
       uc.access_level, uc.granted_by, uc.expires_at
FROM user_capabilities uc
LEFT JOIN contacts c ON c.cid = uc.user_cid
WHERE (uc.expires_at IS NULL OR uc.expires_at > NOW()) AND c.deleted = 0
ORDER BY uc.user_cid, uc.module, uc.capability;

-- ── C. RESTRICTIONS (all users, active) ──────────────────────────────────────
SELECT ucr.user_cid, c.name, c.role AS global_role, ucr.module, ucr.capability,
       ucr.restricted_by, ucr.expires_at
FROM user_capability_restrictions ucr
LEFT JOIN contacts c ON c.cid = ucr.user_cid
WHERE (ucr.expires_at IS NULL OR ucr.expires_at > NOW()) AND c.deleted = 0
ORDER BY ucr.user_cid, ucr.module, ucr.capability;

-- ── D. RESPONSIBILITIES (elevated users only) ────────────────────────────────
SELECT ur.user_cid, c.name, c.role AS global_role, r.key AS responsibility_key, r.name AS responsibility_name
FROM user_responsibilities ur
JOIN responsibilities r ON r.id = ur.responsibility_id
JOIN contacts c ON c.cid = ur.user_cid
WHERE r.is_active = 1 AND c.deleted = 0 AND c.role <> 'participant'
ORDER BY ur.user_cid, r.name;

-- ── E. PROGRAM STAFF ROWS (facilitators + program staff) ─────────────────────
SELECT ps.staff_id AS cid, c.name, c.role AS global_role,
       CAST(ps.program_id AS TEXT) AS program_id, p.name AS program_name,
       p.status AS program_status, ps.role AS program_role, ps.permissions
FROM v2_program_staff ps
JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
LEFT JOIN contacts c ON c.cid = ps.staff_id OR LOWER(TRIM(c.email)) = LOWER(TRIM(ps.staff_id))
WHERE c.deleted = 0
ORDER BY c.name, p.name, ps.role;

-- ── F. ASSIGNED PM PROGRAMS ──────────────────────────────────────────────────
SELECT p.assigned_pm_id AS cid, c.name, c.role AS global_role,
       p.id::text AS program_id, p.name AS program_name, p.status AS program_status,
       p.assigned_assistant_id
FROM v2_programs p
LEFT JOIN contacts c ON c.cid = p.assigned_pm_id
WHERE p.assigned_pm_id IS NOT NULL
ORDER BY c.name, p.name;

-- ── G. PARTICIPANT MEMBERSHIPS OF ELEVATED USERS (Sarah model) ───────────────
SELECT pp.participant_id AS cid, c.name, c.role AS global_role,
       CAST(pp.program_id AS TEXT) AS program_id, p.name AS program_name,
       p.status AS program_status, pp.status AS pp_status, pp.completed_at, pp.certificate_issued
FROM participant_programs pp
JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
LEFT JOIN contacts c ON c.cid = pp.participant_id
WHERE c.deleted = 0 AND c.role <> 'participant'
ORDER BY c.name, p.name;

-- ── H. VENTURE MEMBERSHIPS (current) ─────────────────────────────────────────
SELECT vm.contact_id AS cid, c.name, c.role AS global_role,
       vm.venture_id, COALESCE(v.company_name, v.name) AS venture_name,
       v.status AS venture_status, vm.role AS venture_role, vm.joined_at
FROM venture_members vm
LEFT JOIN ventures v ON v.venture_id = vm.venture_id
LEFT JOIN contacts c ON c.cid = vm.contact_id
WHERE vm.removed_at IS NULL AND c.deleted = 0
ORDER BY c.name, venture_name;

-- ── I. CONTACT_ROLES (all contextual relationships, elevated users) ──────────
SELECT cr.contact_cid AS cid, c.name, c.role AS global_role,
       cr.context_type, cr.context_id, cr.role, cr.title, cr.is_current,
       cr.status, cr.scope, cr.capability_overrides, cr.started_at, cr.ended_at, cr.assigned_by
FROM contact_roles cr
LEFT JOIN contacts c ON c.cid = cr.contact_cid
WHERE c.deleted = 0 AND c.role <> 'participant'
ORDER BY c.name, cr.context_type, cr.started_at DESC;

-- ── J. USER GROUPS (elevated users) ──────────────────────────────────────────
SELECT ug.user_cid AS cid, c.name, c.role AS global_role, ug.group_name, ug.role_in_group
FROM user_groups ug
LEFT JOIN contacts c ON c.cid = ug.user_cid
WHERE c.deleted = 0 AND c.role <> 'participant'
ORDER BY c.name, ug.group_name;

-- ── K. CONSOLIDATED MAP — ONE ROW PER ELEVATED PERSON ────────────────────────
SELECT c.cid, c.name, c.email, c.role AS global_role, c.status,
       COALESCE(ap_explicit.name, ap_role.name) AS effective_profile,
       CASE
         WHEN c.access_profile_id IS NOT NULL THEN 'user'
         WHEN ap_role.id IS NOT NULL THEN 'role'
         ELSE 'legacy'
       END AS profile_source,
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
WHERE c.deleted = 0 AND c.role <> 'participant'
ORDER BY c.role, c.name;

-- ── L. SUMMARY COUNTS ────────────────────────────────────────────────────────
SELECT 'staff_users' AS metric, COUNT(*)::bigint AS value
  FROM contacts WHERE role = 'staff' AND deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'super_admin_users', COUNT(*)::bigint
  FROM contacts WHERE role = 'super_admin' AND deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'facilitator_users', COUNT(*)::bigint
  FROM contacts WHERE role = 'facilitator' AND deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'other_elevated_roles', COUNT(*)::bigint
  FROM contacts WHERE role NOT IN ('participant','staff','super_admin','facilitator') AND deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'elevated_with_explicit_profile', COUNT(*)::bigint
  FROM contacts WHERE role <> 'participant' AND access_profile_id IS NOT NULL AND deleted = 0 AND (archived_at IS NULL OR archived_at IS NULL)
UNION ALL SELECT 'elevated_legacy_only', COUNT(*)::bigint
  FROM contacts c
  WHERE c.role <> 'participant' AND c.deleted = 0 AND (c.archived_at IS NULL OR c.archived_at IS NULL)
    AND c.access_profile_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM user_capabilities uc WHERE uc.user_cid = c.cid AND (uc.expires_at IS NULL OR uc.expires_at > NOW()))
UNION ALL SELECT 'programs_total', COUNT(*)::bigint FROM v2_programs
UNION ALL SELECT 'programs_active', COUNT(*)::bigint FROM v2_programs WHERE status = 'Active'
UNION ALL SELECT 'ventures_total', COUNT(*)::bigint FROM ventures
UNION ALL SELECT 'contact_roles_rows', COUNT(*)::bigint FROM contact_roles
ORDER BY metric;
