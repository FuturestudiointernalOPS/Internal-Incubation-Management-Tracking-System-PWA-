-- Widen the form field-type rule so the builder can store a "country" field.
-- Idempotent: the old rule is dropped if present, then re-created with the
-- complete list. Safe to re-run.
--
-- Apply with:
--   node scripts/db-audit/apply-schema-file.mjs migrations/add_country_form_field_type.sql
--   node scripts/db-audit/apply-schema-file.mjs migrations/add_country_form_field_type.sql --apply .env.local
--
-- The application also widens this rule on its own, once per process, the first
-- time a country field is saved — this file is for databases migrated by hand.

ALTER TABLE platform_form_fields DROP CONSTRAINT IF EXISTS platform_form_fields_field_type_check;
ALTER TABLE platform_form_fields ADD CONSTRAINT platform_form_fields_field_type_check CHECK (field_type IN ('text', 'textarea', 'number', 'email', 'phone', 'date', 'time', 'select', 'radio', 'checkbox', 'multiselect', 'file', 'url', 'rating', 'currency', 'signature', 'richtext', 'hidden', 'country'));
