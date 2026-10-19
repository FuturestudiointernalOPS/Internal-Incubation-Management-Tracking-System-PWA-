-- =============================================================================
-- Retire the legacy per-role capability table
-- =============================================================================
-- Since the profiles takeover, a person's BASE capabilities come from the
-- PROFILE their role defaults to (role_profile_defaults → profiles →
-- profile_capabilities). The per-role table was kept only as a fallback for a
-- profile-less identity; the resolver no longer reads it.
--
-- This is a DESTRUCTIVE, one-way migration. Before running it, confirm that
-- every account still resolves a profile:
--
--   SELECT c.role, COUNT(*) AS people
--   FROM contacts c
--   LEFT JOIN role_profile_defaults rpd ON rpd.role_name = c.role
--   LEFT JOIN contacts o ON o.cid = c.cid AND o.profile_key IS NOT NULL
--   WHERE o.cid IS NULL AND rpd.role_name IS NULL
--   GROUP BY c.role;
--
-- Expect zero rows. Any row names an identity that would lose its base rights.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS role_capabilities;

COMMIT;
