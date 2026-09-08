-- =============================================================================
-- MODULE 5 EXTENSION — PLATFORM INTEGRATIONS
-- Adds external sync columns for Calendar and Notion integrations.
-- =============================================================================

-- ─── Calendar Sync for Form Runs ───
ALTER TABLE platform_form_runs ADD COLUMN IF NOT EXISTS external_calendar_id TEXT;
ALTER TABLE platform_form_runs ADD COLUMN IF NOT EXISTS external_calendar_url TEXT;

-- ─── Notion Sync for Submissions ───
ALTER TABLE platform_form_submissions ADD COLUMN IF NOT EXISTS notion_page_id TEXT;

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_form_runs_calendar ON platform_form_runs(external_calendar_id) WHERE external_calendar_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_submissions_notion ON platform_form_submissions(notion_page_id) WHERE notion_page_id IS NOT NULL;
