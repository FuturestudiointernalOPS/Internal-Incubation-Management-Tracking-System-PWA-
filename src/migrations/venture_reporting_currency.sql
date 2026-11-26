-- ─────────────────────────────────────────────────────────────────────────────
-- Venture reporting — the currency each report was FILED IN.
--
-- The Venture's reporting currency (`venture_static_profile.reporting_currency`)
-- is a CURRENT setting. The money inside a report is a historical fact, so the
-- unit is stamped on the row at save time: changing the setting tomorrow must
-- never re-label a month (or a quarter, an event, a baseline) already reported.
--
-- The application also applies these statements at runtime
-- (`ensureReportingSchema`), idempotently. They are repeated here so a
-- deployment that sets SKIP_RUNTIME_SCHEMA_MAINTENANCE=true can migrate the
-- database itself. Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS venture_monthly_report
  ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE IF EXISTS venture_quarterly_report
  ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE IF EXISTS venture_event_log
  ADD COLUMN IF NOT EXISTS currency TEXT;

ALTER TABLE IF EXISTS venture_baseline
  ADD COLUMN IF NOT EXISTS currency TEXT;

-- Rows written before this migration keep `NULL` and are displayed in the
-- Venture's current currency — the best answer available for them.
