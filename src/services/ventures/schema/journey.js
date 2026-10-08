/**
 * Vinance 3 — notifications, journey templates, reports and archiving.
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 */

export default [
// ─── Vinance 3 Phase 1 — notification entity context (drill-down) ───
// Soft refs (nullable TEXT) so every producer can record WHERE the
// notification happened (venture → journey → milestone → task/session).
// Old rows simply have NULL context and degrade gracefully.
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_venture_id TEXT",
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_journey_stage_id TEXT",
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_milestone_id TEXT",
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_task_id TEXT",
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS entity_session_id TEXT",
// Vinance 3 — notification hardening (template keys + params for local
// rendering, seen/read lifecycle, dedupe keys for idempotent producers).
// All nullable: legacy rows and existing consumers are untouched.
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS template_key TEXT",
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS params JSONB",
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT",
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS seen_at TIMESTAMPTZ",
"ALTER TABLE v2_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ",
"CREATE INDEX IF NOT EXISTS idx_notif_dedupe ON v2_notifications(recipient_id, dedupe_key) WHERE dedupe_key IS NOT NULL",
// ─── Vinance 3 — Journey template library (Save-as-Template) ───
// Structure-only copies of an entire Venture Journey (stages + milestones
// + top-level tasks). Independent from Venture rows by design: templates
// are reusable blueprints, never a live view of the Venture.
"CREATE TABLE IF NOT EXISTS venture_journey_templates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, description TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_journey_template_stages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), template_id UUID NOT NULL REFERENCES venture_journey_templates(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT, objective TEXT, stage_order INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(template_id, stage_order))",
"CREATE TABLE IF NOT EXISTS venture_journey_template_milestones (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), stage_id UUID NOT NULL REFERENCES venture_journey_template_stages(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, objective TEXT, priority TEXT DEFAULT 'medium', display_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_journey_template_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), milestone_id UUID NOT NULL REFERENCES venture_journey_template_milestones(id) ON DELETE CASCADE, title TEXT NOT NULL, description TEXT, priority TEXT DEFAULT 'medium', labels JSONB DEFAULT '[]', checklist JSONB DEFAULT '[]', review_required BOOLEAN DEFAULT FALSE, required_deliverable_type TEXT, display_order INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
// Vinance 3 Phase 2 — contextual notes: attachments (text/links/files)
"ALTER TABLE venture_notes ADD COLUMN IF NOT EXISTS attachments JSONB",
// Vinance 3 Phase 1 (coach identity) — sessions know WHO the coach is as
// a platform user (Future Studio staff or invited external coach). Soft
// ref: legacy venture_coaches rows keep working via coach_name fallback.
"ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS coach_contact_id TEXT",
// Vinance 3 Phase 3 — typed Venture Progress Reports (Manager → Super Admin)
"CREATE TABLE IF NOT EXISTS venture_reports (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, title TEXT NOT NULL, reporting_period TEXT, summary TEXT, current_journey TEXT, current_milestone TEXT, completed_items JSONB DEFAULT '[]'::jsonb, outstanding_items JSONB DEFAULT '[]'::jsonb, support_delivered TEXT, challenges TEXT, recommendation TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), submitted_at TIMESTAMPTZ)",
"CREATE INDEX IF NOT EXISTS idx_venture_reports_venture ON venture_reports(venture_id, status)",
// A report BELONGS to a journey. The period-based report stays valid, but
// "every journey needs a report" needs a real reference — `current_journey`
// is free text and can never be queried. Existing rows keep this NULL and are
// never back-filled by guessing at their free text.
"ALTER TABLE venture_reports ADD COLUMN IF NOT EXISTS journey_stage_id UUID",
// 'progress' (interim, any time) or 'closing' (the journey's final report).
// A journey has at most ONE closing report; extra interim reports are
// allowed and LABELLED, never blocked.
"ALTER TABLE venture_reports ADD COLUMN IF NOT EXISTS report_kind TEXT",
// Milestone & task archiving (soft delete). Archived rows stay in the
// database forever (history preserved) but are hidden from default lists.
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS archived_by TEXT",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS archived_by TEXT",
];
