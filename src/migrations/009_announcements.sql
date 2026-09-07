-- =============================================================================
-- IMPACTOS v2 — ANNOUNCEMENTS SYSTEM (Ticket 4.5 / Module 4)
-- =============================================================================
-- Provides organization-wide announcements with audience targeting.
-- Supports: all, group, project, program targeting.
-- Announcements stay visible until archived (soft delete).
-- =============================================================================

CREATE TABLE IF NOT EXISTS v2_announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL DEFAULT 'all',  -- 'all', 'group', 'project', 'program'
  target_id TEXT,                            -- group_name, project_id, or program_id
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient filtering by target
CREATE INDEX IF NOT EXISTS idx_announcements_target ON v2_announcements (target_type, target_id);

-- Index for fetching active announcements
CREATE INDEX IF NOT EXISTS idx_announcements_active ON v2_announcements (is_archived, is_pinned, created_at DESC);
