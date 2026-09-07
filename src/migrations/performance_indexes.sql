-- Performance Index Migration
-- Fix slow queries identified by forensic logging
-- All use IF NOT EXISTS — safe to re-run

-- 1. user_sessions.token — session lookup (3.1s bottleneck)
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);

-- 2. user_sessions.expires_at — session cleanup
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- 3. v2_notifications.recipient_id + is_read — notification fetch (3.7s bottleneck)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON v2_notifications(recipient_id, is_read, created_at DESC);

-- 4. tasks.user_id + status — task queries
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);

-- 5. tasks.assigned_to + status — assignment queries
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON tasks(assigned_to, status);

-- 6. tasks.project_id + status — project task stats
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);

-- 7. blockers.task_id + status — blocker lookups
CREATE INDEX IF NOT EXISTS idx_blockers_task_status ON blockers(task_id, status);

-- 8. blockers.status — active blockers filter
CREATE INDEX IF NOT EXISTS idx_blockers_status ON blockers(status);

-- 9. v2_op_reports lookup — standup/retro queries
CREATE INDEX IF NOT EXISTS idx_v2_op_reports_user_week ON v2_op_reports(user_id, week_number, year, report_type);

-- 10. project_members.user_cid — collaborator lookup
CREATE INDEX IF NOT EXISTS idx_project_members_cid ON project_members(user_cid);
