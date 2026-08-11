-- Migration: Project Discussions (Ticket 4.3)
-- Adds project_id column to v2_messages for project-scoped discussions.

ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_v2_messages_project_id ON v2_messages(project_id);
