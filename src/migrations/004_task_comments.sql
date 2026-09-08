-- Migration: Task Discussions (Ticket 4.2)
-- Creates task_comments table for task-level discussion threads.

CREATE TABLE IF NOT EXISTS v2_task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  parent_id INTEGER REFERENCES v2_task_comments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON v2_task_comments(task_id);
