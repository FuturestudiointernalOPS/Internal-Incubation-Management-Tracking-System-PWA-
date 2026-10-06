/**
 * Phase 5 operating model and Phase 2 canonical core spine.
 *
 * One part of the Venture schema bootstrap; concatenated, in order, by
 * `../schema.js`. Statement order across parts is significant.
 */

export default [
// ─── Phase 5 — Configurable Venture Operating Model (additive) ───
// Reusable playbook templates (Future Studio defines, Ventures execute snapshots)
"CREATE TABLE IF NOT EXISTS venture_playbook_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_playbook_template_stages (id SERIAL PRIMARY KEY, template_id INTEGER NOT NULL REFERENCES venture_playbook_templates(id) ON DELETE CASCADE, stage_order INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, objective TEXT, completion_criteria TEXT, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(template_id, stage_order))",
"CREATE TABLE IF NOT EXISTS venture_milestone_templates (id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT, expected_outcome TEXT, default_due_days INTEGER, is_active BOOLEAN DEFAULT TRUE, created_by TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_task_templates (id SERIAL PRIMARY KEY, milestone_template_id INTEGER REFERENCES venture_milestone_templates(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT, requirement_type TEXT NOT NULL DEFAULT 'activity', is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW())",
"CREATE TABLE IF NOT EXISTS venture_playbook_stage_milestones (id SERIAL PRIMARY KEY, stage_id INTEGER NOT NULL REFERENCES venture_playbook_template_stages(id) ON DELETE CASCADE, milestone_template_id INTEGER NOT NULL REFERENCES venture_milestone_templates(id) ON DELETE CASCADE, sort_order INTEGER DEFAULT 0, UNIQUE(stage_id, milestone_template_id))",
// Per-venture playbook instance — a SNAPSHOT; template edits never rewrite it
"CREATE TABLE IF NOT EXISTS venture_playbook_instances (id SERIAL PRIMARY KEY, venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE, template_id INTEGER NOT NULL REFERENCES venture_playbook_templates(id), assigned_by TEXT, assigned_at TIMESTAMP DEFAULT NOW(), UNIQUE(venture_id))",
"CREATE TABLE IF NOT EXISTS venture_playbook_instance_stages (id SERIAL PRIMARY KEY, instance_id INTEGER NOT NULL REFERENCES venture_playbook_instances(id) ON DELETE CASCADE, template_stage_id INTEGER, stage_order INTEGER NOT NULL, name TEXT NOT NULL, description TEXT, objective TEXT, completion_criteria TEXT, status TEXT NOT NULL DEFAULT 'locked', completed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(instance_id, stage_order))",
// Snapshot provenance on execution tables + task requirement types
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS template_id INTEGER",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS template_id INTEGER",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS requirement_type TEXT DEFAULT 'activity'",
// Task reviews (accept / reject / revision requested) with history
"CREATE TABLE IF NOT EXISTS venture_task_reviews (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, reviewer_cid TEXT, reviewer_name TEXT, decision TEXT NOT NULL, comments TEXT, created_at TIMESTAMP DEFAULT NOW())",
"CREATE INDEX IF NOT EXISTS idx_venture_task_reviews_task ON venture_task_reviews(task_id)",
// ─── Phase 2 — Canonical Core Spine (additive, non-destructive) ───
// Milestones become Journey-bound units of progress (journey stage parent).
// Columns are nullable so existing milestones are untouched until staff bind
// them to a Journey stage. owner_cid/priority keep the legacy 016 concepts
// available without depending on which milestone DDL created the table.
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS journey_stage_id UUID",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS objective TEXT",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS start_date DATE",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS display_order INTEGER",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS priority TEXT",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS owner_cid TEXT",
// An assignment has TWO halves: the identity (`*_cid`, nullable — a person
// on a plan need not have an account) and the name the tracker wrote
// (`*_name`). Both must be self-healed here, or applying an imported plan
// dies on `column "..._name" ... does not exist` in any environment that
// never received the name column by hand.
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS owner_name TEXT",
"ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS assigned_cid TEXT",
"ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS assigned_name TEXT",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS assigned_cid TEXT",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS assigned_name TEXT",
// The tracker's extra context is stored as REAL fields, never folded text:
// the Definition of Done keeps its own column on the task that owes it,
// Support is a display-only name (multi-name as written — nobody is assigned
// work by it), and a deliverable points at the task that produces it, so
// "Activity → Deliverable" is a relationship rather than a convention.
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS definition_of_done TEXT",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS support_name TEXT",
// The tracker's own row reference (e.g. MS-01) stays WITH the task it labelled
// — a persistent reference the live record keeps, not a value used only while
// applying an import.
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS source_ref TEXT",
"ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS support_name TEXT",
"ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES venture_tasks(id) ON DELETE SET NULL",
"CREATE INDEX IF NOT EXISTS idx_vm_journey_stage ON venture_milestones(journey_stage_id) WHERE journey_stage_id IS NOT NULL",
// Task review-required flag + optional required deliverable type (D5).
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS review_required BOOLEAN DEFAULT FALSE",
"ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS required_deliverable_type TEXT",
// Sessions become Journey-connected and can be marked Venture-facing (D2/D7).
// Soft refs (TEXT/UUID without FK) keep both legacy venture_milestones DDLs
// compatible — no type mismatch risk.
"ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS journey_stage_id UUID",
"ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS milestone_ref TEXT",
"ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS task_id INTEGER",
"ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS preparation_notes TEXT",
"ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS venture_facing BOOLEAN DEFAULT FALSE",
// A session always belongs to a milestone; it may additionally be attached
// to one of that milestone's deliverables (soft ref — no FK, like
// milestone_ref itself).
"ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS deliverable_id TEXT",
// Documents the participants need for a session (a deck to review, a brief
// to read), attached while booking. Rows store [{path,name,size}]; the files
// live in the private evidence bucket under a `sessions/` prefix and are
// signed on read, so only people with Venture access can open them.
"ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS materials JSONB",
// Task submissions (D5): append-only versions; founder submits, staff
// reviews (approved | changes_requested); official task completion requires
// an approved submission when review_required = TRUE.
"CREATE TABLE IF NOT EXISTS venture_task_submissions (id SERIAL PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE, version INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'submitted', file_url TEXT, file_name TEXT, file_type TEXT, file_size BIGINT, notes TEXT, submitted_by TEXT, submitted_by_name TEXT, reviewed_by TEXT, review_decision TEXT, review_comment TEXT, reviewed_at TIMESTAMP, created_at TIMESTAMP DEFAULT NOW(), UNIQUE(task_id, version))",
"CREATE INDEX IF NOT EXISTS idx_vts_task ON venture_task_submissions(task_id, version)",
// KPI library extension (Phase 5 — formula/frequency/measurement)
"ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS formula TEXT",
"ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS frequency TEXT",
"ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS measurement_method TEXT",
"ALTER TABLE venture_kpi_definitions ADD COLUMN IF NOT EXISTS default_target NUMERIC",
];
