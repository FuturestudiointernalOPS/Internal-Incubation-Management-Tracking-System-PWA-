-- CAPABILITY DEFAULTS — POST-DEPLOY VERIFICATION (read-only).
--
-- Run AFTER the application has booted once on the new code: the backfill
-- `profile-capability-defaults-v1` is applied at that point and recorded in
-- `authz_migrations`. The rows below are the capabilities that replaced a role
-- list; each is granted to the profile that already held the access.
--
-- Writes nothing. Safe to paste in any SQL console.

SELECT * FROM (
  SELECT 'migration enregistrée' AS controle,
         COUNT(*)::int AS valeur,
         '1' AS attendu
  FROM authz_migrations
  WHERE name = 'profile-capability-defaults-v1'

  UNION ALL

  SELECT 'staff_default · ventures.setup', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'staff_default' AND module = 'ventures' AND capability = 'setup'

  UNION ALL

  SELECT 'staff_default · ventures.kpis', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'staff_default' AND module = 'ventures' AND capability = 'kpis'

  UNION ALL

  SELECT 'staff_default · ventures.permissions_view', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'staff_default' AND module = 'ventures' AND capability = 'permissions_view'

  UNION ALL

  SELECT 'staff_default · programs.groups', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'staff_default' AND module = 'programs' AND capability = 'groups'

  UNION ALL

  SELECT 'staff_default · collections.view', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'staff_default' AND module = 'collections' AND capability = 'view'

  UNION ALL

  SELECT 'staff_default · contacts.invite_families', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'staff_default' AND module = 'contacts' AND capability = 'invite_families'

  UNION ALL

  SELECT 'staff_default · ventures.my_assignments', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'staff_default' AND module = 'ventures' AND capability = 'my_assignments'

  UNION ALL

  -- The cross-Venture portfolio is the platform owner's; it must NOT have been
  -- granted to the staff profile. This line proves the switch widened nothing.
  SELECT 'staff_default ne porte pas reports.portfolio', COUNT(*)::int, '0'
  FROM profile_capabilities
  WHERE profile_key = 'staff_default' AND module = 'reports' AND capability = 'portfolio'

  UNION ALL

  SELECT 'program_manager · programs.groups', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'program_manager' AND module = 'programs' AND capability = 'groups'

  UNION ALL

  SELECT 'program_manager · ventures.kpis', COUNT(*)::int, '1'
  FROM profile_capabilities
  WHERE profile_key = 'program_manager' AND module = 'ventures' AND capability = 'kpis'

  UNION ALL

  -- A staff account whose profile override is NOT the default profile. The
  -- backfill grants the capabilities to `staff_default`; a narrower explicit
  -- profile must be granted separately if that person still needs the action.
  SELECT 'personnel avec profil explicite (à vérifier)', COUNT(*)::int, 'signalé'
  FROM contacts c
  WHERE LOWER(c.role) = 'staff'
    AND COALESCE(NULLIF(TRIM(c.profile_key), ''), 'staff_default') <> 'staff_default'
) rapport
ORDER BY controle;
