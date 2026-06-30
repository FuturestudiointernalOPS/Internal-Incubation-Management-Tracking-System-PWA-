-- ============================================================================
-- Migration: Add pending_project_approval to tasks status check constraint
--
-- The original constraint only allowed: pending, in_progress, blocked,
-- completed, carried_over. When a non-member creates a task for a project,
-- the API sets status = 'pending_project_approval' which violated the CHECK.
-- Also added 'archived' for task archiving support.
-- ============================================================================

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'in_progress'::text,
    'blocked'::text,
    'completed'::text,
    'carried_over'::text,
    'pending_project_approval'::text,
    'archived'::text
  ]));
