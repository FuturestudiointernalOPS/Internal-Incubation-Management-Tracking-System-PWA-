-- AUTHZ MIGRATIONS — STATUS AND LAST FAILURE (read-only).
--
-- Run this after the application has booted once on the build that records
-- failures (`authz_migration_failures`, created by the migration ledger).
--
-- Why it exists: a failed migration is rolled back and its marker is never
-- written — correct, but the reason lived only in the server log. This table
-- makes the reason readable from any SQL console.
--
-- The two markers below are the ones that matter for the permission switch.

SELECT 'appliquée' AS etat,
       name AS migration,
       '' AS detail,
       applied_at AS quand
FROM authz_migrations
WHERE name IN (
  'legacy-identities-normalization-v1',
  'profile-capability-defaults-v1'
)

UNION ALL

SELECT 'échec' AS etat,
       name AS migration,
       COALESCE(error, '') AS detail,
       failed_at AS quand
FROM authz_migration_failures

ORDER BY etat, migration;
