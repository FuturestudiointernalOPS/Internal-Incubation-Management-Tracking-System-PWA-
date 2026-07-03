-- Task assignment workflow (Ticket 1.4). Idempotent.
CREATE TABLE IF NOT EXISTS task_assignments (
  id           SERIAL PRIMARY KEY,
  task_id      INTEGER NOT NULL,
  assigner_id  TEXT NOT NULL,
  assignee_id  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined')),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_task_assignments_assignee
  ON task_assignments (assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_task
  ON task_assignments (task_id);
