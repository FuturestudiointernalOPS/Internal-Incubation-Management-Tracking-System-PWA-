/**
 * Permissions, internal notes and operating plans.
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 */

export default [
// ─── Phase P1 — Configurable Venture Permissions (additive) ───
// Responsibilities are configurable, contextual assignments (names are
// editable from the UI; the stable code is what assignments/matrix use).
"CREATE TABLE IF NOT EXISTS venture_responsibilities (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
"ALTER TABLE venture_responsibilities ADD COLUMN IF NOT EXISTS created_by TEXT",
"CREATE TABLE IF NOT EXISTS venture_scope_types (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())",
// Platform GLOBAL matrix (responsibility x area x action). Seed = agreed defaults.
// Permission profiles belong to the RESPONSIBILITY, never to an individual
// Venture. Assignments + scope decide where a profile applies.
"CREATE TABLE IF NOT EXISTS venture_permission_matrix (id SERIAL PRIMARY KEY, responsibility_code TEXT NOT NULL, area TEXT NOT NULL, action TEXT NOT NULL, allowed BOOLEAN DEFAULT FALSE, updated_by TEXT, updated_at TIMESTAMP DEFAULT NOW(), UNIQUE(responsibility_code, area, action))",
// NOTE: per-Venture overrides are intentionally NOT part of the model — the
// global matrix is the single source of truth for every Venture.
// venture_staff_assignments is the ONLY per-Venture access data (who, which
// responsibility, which scope).
// Staff assignments: assignment-ROW based. A person may hold several
// responsibilities on the same Venture (no (venture,staff) uniqueness) and
// different responsibilities across Ventures. Access is per assignment.
"CREATE TABLE IF NOT EXISTS venture_staff_assignments (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, staff_contact_id TEXT NOT NULL, responsibility_code TEXT NOT NULL, scope_type TEXT NOT NULL DEFAULT 'venture_wide', scope_ref_type TEXT, scope_ref_id TEXT, assigned_by TEXT, notes TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW(), removed_at TIMESTAMP)",
"CREATE INDEX IF NOT EXISTS idx_vsa_venture ON venture_staff_assignments(venture_id, status)",
"CREATE INDEX IF NOT EXISTS idx_vsa_staff ON venture_staff_assignments(staff_contact_id, status)",
// ─── Phase P4 — Internal Venture Notes (staff-only; founders never) ───
"CREATE TABLE IF NOT EXISTS venture_notes (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, author_cid TEXT, author_name TEXT, title TEXT NOT NULL, body TEXT NOT NULL, scope_ref_type TEXT, scope_ref_id TEXT, is_archived BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_venture_notes_venture ON venture_notes(venture_id, is_archived)",
// Legacy marker from the trial: identifies notes that were auto-filed from a
// session. The memo now lives on the session ONLY — the milestone record is
// the manager's own writing, never a copy — so nothing writes this column any
// more. It is kept so trial-era rows stay identifiable and a fresh database
// matches an existing one.
"ALTER TABLE venture_notes ADD COLUMN IF NOT EXISTS source_session_id INTEGER",
// ─── Phase P4b — Venture Operating Plans (Lead Manager instrument) ───
"CREATE TABLE IF NOT EXISTS venture_operating_plans (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, name TEXT NOT NULL, objective TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_vop_venture ON venture_operating_plans(venture_id)",
"CREATE TABLE IF NOT EXISTS venture_plan_sections (id SERIAL PRIMARY KEY, plan_id INTEGER NOT NULL REFERENCES venture_operating_plans(id) ON DELETE CASCADE, title TEXT NOT NULL, objective TEXT, instructions TEXT, sort_order INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'not_started', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_vps_plan ON venture_plan_sections(plan_id)",
// Links a plan section to existing Venture objects (milestone/task/document/session/note).
"CREATE TABLE IF NOT EXISTS venture_plan_links (id SERIAL PRIMARY KEY, section_id INTEGER NOT NULL REFERENCES venture_plan_sections(id) ON DELETE CASCADE, ref_type TEXT NOT NULL, ref_id TEXT NOT NULL, label TEXT, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(section_id, ref_type, ref_id))",
"CREATE INDEX IF NOT EXISTS idx_vpl_section ON venture_plan_links(section_id)",
// ─── Phase P5 — Reusable Operating-Plan Templates (structure only) ───
"CREATE TABLE IF NOT EXISTS venture_plan_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_plan_template_sections (id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL REFERENCES venture_plan_templates(id) ON DELETE CASCADE, title TEXT NOT NULL, objective TEXT, instructions TEXT, sort_order INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_vpts_template ON venture_plan_template_sections(template_id)",
];
