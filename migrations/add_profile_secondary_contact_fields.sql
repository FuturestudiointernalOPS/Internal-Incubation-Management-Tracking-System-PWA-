-- =============================================================================
-- Optional profile secondary contact fields
-- -----------------------------------------------------------------------------
-- Additive and idempotent. Safe to run against the intended database.
--
--   contacts.alternative_email TEXT  — optional secondary communication channel
--   contacts.alternative_phone TEXT  — optional backup phone
--   contacts.country            TEXT  — optional country
--
-- These are NOT required for account creation. The profile API already reads and
-- writes these fields defensively, so running this script is only needed to make
-- the values persist (until then the fields silently fall back to null).
-- =============================================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS alternative_email TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS alternative_phone TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS country TEXT;
