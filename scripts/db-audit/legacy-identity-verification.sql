-- LEGACY IDENTITIES — POST-MIGRATION VERIFICATION (read-only).
--
-- Run AFTER the application has booted once on the new code: the migration is
-- applied automatically at that point and recorded in `authz_migrations`.
-- One result set; writes nothing.
--
-- The migration's own guard already refused to commit when an active
-- relationship had no card, atomically. These lines confirm the OUTCOME; the
-- per-person relationship check lives in the guard, not here.

SELECT * FROM (
  SELECT 'migration enregistrée' AS controle,
         COUNT(*)::int AS valeur,
         '1' AS attendu
  FROM authz_migrations
  WHERE name = 'legacy-identities-normalization-v1'

  UNION ALL

  SELECT 'anciens rôles restants',
         COUNT(*)::int,
         '0'
  FROM contacts
  WHERE role IN ('participant', 'facilitator', 'investor', 'founder')

  UNION ALL

  SELECT 'cartes créées par la migration',
         COUNT(*)::int,
         '≈ 564'
  FROM profile_assignments
  WHERE notes = 'legacy-identity-migration' AND status = 'active'

  UNION ALL

  SELECT 'personnes normalisées (membres)',
         COUNT(*)::int,
         '≈ 569'
  FROM contacts
  WHERE role = 'member'

  UNION ALL

  SELECT 'sessions ouvertes sous un ancien nom',
         COUNT(*)::int,
         'signalé'
  FROM user_sessions
  WHERE expires_at > NOW()
    AND role IN ('participant', 'facilitator', 'investor', 'founder')
) rapport
ORDER BY controle;
