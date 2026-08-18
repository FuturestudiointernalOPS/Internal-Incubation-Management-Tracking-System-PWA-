-- =============================================================================
-- Basic User Profile fields
-- -----------------------------------------------------------------------------
-- Additive and idempotent. Safe to run against the intended database.
--
--   contacts.image          TEXT  — profile photo URL (already in base schema,
--                                   re-asserted here for clarity/idempotency)
--   contacts.last_login_at  TIMESTAMPTZ — timestamp of last successful login
--   contacts.login_count    INTEGER — number of successful logins
--
-- `status`, `language`, `phone`, `group_name`, and `created_at` already exist
-- in the base contacts table and are used by the profile API as-is.
-- =============================================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;

-- Standardized country code (ISO 3166-1 alpha-2, e.g. "BJ", "FR", "US").
-- Display names are resolved at runtime via Intl.DisplayNames.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country_code TEXT;
