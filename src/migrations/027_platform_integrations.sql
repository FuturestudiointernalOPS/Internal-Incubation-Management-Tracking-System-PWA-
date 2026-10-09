-- =============================================================================
-- MODULE 5 EXTENSION — PLATFORM INTEGRATIONS
-- Adds external sync columns for the Calendar integration.
-- =============================================================================

-- ─── Calendar Sync for Form Runs ───
ALTER TABLE platform_form_runs ADD COLUMN IF NOT EXISTS external_calendar_id TEXT;
ALTER TABLE platform_form_runs ADD COLUMN IF NOT EXISTS external_calendar_url TEXT;

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_form_runs_calendar ON platform_form_runs(external_calendar_id) WHERE external_calendar_id IS NOT NULL;
