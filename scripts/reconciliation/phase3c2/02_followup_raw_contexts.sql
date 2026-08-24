-- =============================================================================
-- PHASE 3C-2 — FOLLOW-UP: RAW CONTEXT TABLES + FIXED CONSOLIDATED MAP
-- READ ONLY — SELECT statements only.
-- =============================================================================

-- ── 1. v2_program_staff — raw (any rows at all?) ─────────────────────────────
SELECT * FROM v2_program_staff ORDER BY updated_at DESC LIMIT 100;

-- ── 2. contact_roles — raw (any rows at all?) ────────────────────────────────
SELECT * FROM contact_roles ORDER BY started_at DESC LIMIT 100;

-- ── 3. v2_teams — team handlers (facilitator scope mechanism) ────────────────
SELECT id, program_id, name, handler_id FROM v2_teams ORDER BY name LIMIT 100;

-- ── 4. families (segments) — program linkage + default_role ──────────────────
SELECT id, name, program_id, default_role FROM families ORDER BY name LIMIT 100;

-- ── 5. v2_groups — system/participant groups per program ─────────────────────
SELECT id, program_id, name, type, is_system FROM v2_groups ORDER BY name LIMIT 100;

-- ── 6. ventures — does the table exist and have rows? ────────────────────────
SELECT column_name FROM information_schema.columns WHERE table_name = 'ventures' ORDER BY ordinal_position;

-- ── 7. The single program — full picture ─────────────────────────────────────
SELECT id, name, status, assigned_pm_id, assigned_assistant_id, program_type,
       start_date, end_date, is_template
FROM v2_programs ORDER BY created_at DESC LIMIT 10;

-- ── 8. responsibilities — what exists to assign ──────────────────────────────
SELECT id, key, name, is_active FROM responsibilities ORDER BY name;

-- ── 9. user_groups — raw (any rows at all?) ──────────────────────────────────
SELECT * FROM user_groups ORDER BY group_name LIMIT 100;

-- ── 10. FIXED CONSOLIDATED MAP — ONE ROW PER ELEVATED PERSON ─────────────────
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
       (c.access_profile_id IS NULL AND grants.grants IS NULL) AS no_explicit_access
FROM contacts c
LEFT JOIN access_profiles ap_explicit ON ap_explicit.id = c.access_profile_id
LEFT JOIN role_access_profile_defaults rpd ON rpd.role_name = c.role
LEFT JOIN access_profiles ap_role ON ap_role.id = rpd.access_profile_id
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT r.name, ', ') AS responsibilities
  FROM user_responsibilities ur
  JOIN responsibilities r ON r.id = ur.responsibility_id
  WHERE ur.user_cid = c.cid AND r.is_active = 1
) resp ON true
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT ps.role || ' @ ' || p.name, ', ') AS program_roles
  FROM v2_program_staff ps
  JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(ps.program_id AS TEXT)
  WHERE (ps.staff_id = c.cid OR LOWER(TRIM(ps.staff_id)) = LOWER(TRIM(c.email)))
) prog_staff ON true
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT 'PM @ ' || p.name, ', ') AS pm_programs
  FROM v2_programs p
  WHERE p.assigned_pm_id = c.cid
) pm ON true
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT 'Participant @ ' || p.name || COALESCE(' (' || pp.status || ')', ''), ', ') AS participant_programs
  FROM participant_programs pp
  JOIN v2_programs p ON CAST(p.id AS TEXT) = CAST(pp.program_id AS TEXT)
  WHERE pp.participant_id = c.cid
) parts ON true
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT 'Member @ ' || v.name, ', ') AS ventures
  FROM venture_members vm
  LEFT JOIN ventures v ON v.id = vm.venture_id
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
  SELECT string_agg(DISTINCT uc.module || '.' || uc.capability || '@' || uc.access_level, ', ') AS grants
  FROM user_capabilities uc
  WHERE uc.user_cid = c.cid AND (uc.expires_at IS NULL OR uc.expires_at > NOW())
) grants ON true
LEFT JOIN LATERAL (
  SELECT string_agg(DISTINCT ucr.module || '.' || ucr.capability, ', ') AS restrictions
  FROM user_capability_restrictions ucr
  WHERE ucr.user_cid = c.cid AND (ucr.expires_at IS NULL OR ucr.expires_at > NOW())
) restr ON true
WHERE c.deleted = 0 AND c.role <> 'participant'
ORDER BY c.role, c.name;
