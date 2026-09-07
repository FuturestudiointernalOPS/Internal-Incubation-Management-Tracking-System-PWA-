-- ============================================================
-- Venture Phase 2 — Canonical Core Spine (additive only)
-- Apply manually in the Supabase SQL editor, OR rely on the
-- idempotent runtime self-healing in src/lib/ventures.js
-- (ensureVentureSchema), which applies the same statements.
-- Safe to run multiple times. Nothing is dropped.
-- ============================================================

-- ─── Milestones become Journey-bound units of progress ───
-- Nullable: existing milestones stay untouched until staff bind them
-- to a Journey stage. owner_cid/priority keep the legacy 016 concepts
-- available without depending on which milestone DDL created the table.
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS journey_stage_id UUID;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS display_order INTEGER;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS priority TEXT;
ALTER TABLE venture_milestones ADD COLUMN IF NOT EXISTS owner_cid TEXT;
CREATE INDEX IF NOT EXISTS idx_vm_journey_stage
  ON venture_milestones(journey_stage_id)
  WHERE journey_stage_id IS NOT NULL;

-- ─── Task review authority (founders cannot self-approve) ───
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS review_required BOOLEAN DEFAULT FALSE;
ALTER TABLE venture_tasks ADD COLUMN IF NOT EXISTS required_deliverable_type TEXT;

-- ─── Sessions become Journey-connected and Venture-facing opt-in ───
-- Soft refs (UUID/TEXT without FK) keep both legacy venture_milestones
-- DDLs compatible — no type mismatch risk.
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS journey_stage_id UUID;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS milestone_ref TEXT;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS task_id INTEGER;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS preparation_notes TEXT;
ALTER TABLE venture_sessions ADD COLUMN IF NOT EXISTS venture_facing BOOLEAN DEFAULT FALSE;

-- ─── Task submissions (append-only versions) ───
-- Founder submits; staff review (approved | changes_requested). Official
-- completion requires an approved submission when review_required = TRUE.
CREATE TABLE IF NOT EXISTS venture_task_submissions (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES venture_tasks(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'submitted',
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  notes TEXT,
  submitted_by TEXT,
  submitted_by_name TEXT,
  reviewed_by TEXT,
  review_decision TEXT,
  review_comment TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(task_id, version)
);
CREATE INDEX IF NOT EXISTS idx_vts_task ON venture_task_submissions(task_id, version);
