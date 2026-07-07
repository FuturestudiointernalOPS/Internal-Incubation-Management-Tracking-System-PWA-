-- Module 4 — Communication & Collaboration
-- Run in Supabase SQL Editor. All IF NOT EXISTS — safe to re-run.

-- 1. Project Discussions (4.3)
ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS project_id TEXT;
CREATE INDEX IF NOT EXISTS idx_v2_messages_project_id ON v2_messages(project_id);

-- 2. Message Attachments (4.1)
ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE v2_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- 3. Announcements (4.5)
CREATE TABLE IF NOT EXISTS v2_announcements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'organization',
  target_id TEXT,
  is_pinned BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON v2_announcements(is_pinned, is_archived);
CREATE INDEX IF NOT EXISTS idx_announcements_target ON v2_announcements(target_type, target_id);
