-- ============================================================================
-- STEP 1: PRE-CLEANUP RECORD COUNTS
-- Run this FIRST to see what will be deleted.
-- ============================================================================

-- Users to retain (@epitech.eu)
SELECT '=== RETAINED USERS (eligible for retention) ===' AS info;
SELECT cid, name, email, role, group_name FROM contacts WHERE email ILIKE '%@epitech.eu' AND deleted = 0;

-- Users to delete (non-@epitech.eu)
SELECT '=== USERS TO BE DELETED ===' AS info;
SELECT cid, name, email, role, group_name FROM contacts WHERE email NOT ILIKE '%@epitech.eu' AND email NOT ILIKE '%@futurestudio%' AND deleted = 0;

-- Counts of records that will be affected
SELECT '=== RECORD COUNTS TO BE REMOVED ===' AS info;

SELECT 'CONTACTS (non-epitech)' AS table_name, COUNT(*) AS count FROM contacts WHERE email NOT ILIKE '%@epitech.eu' AND deleted = 0
UNION ALL
SELECT 'v2_programs (all)', COUNT(*) FROM v2_programs WHERE is_archived IS NULL OR is_archived = 0
UNION ALL
SELECT 'v2_submissions (all)', COUNT(*) FROM v2_submissions
UNION ALL
SELECT 'v2_projects (all)', COUNT(*) FROM v2_projects WHERE status != 'Archived'
UNION ALL
SELECT 'tasks (all)', COUNT(*) FROM tasks
UNION ALL
SELECT 'v2_messages (all)', COUNT(*) FROM v2_messages
UNION ALL
SELECT 'v2_notifications (all)', COUNT(*) FROM v2_notifications
UNION ALL
SELECT 'v2_op_reports (all)', COUNT(*) FROM v2_op_reports
UNION ALL
SELECT 'participant_programs (all)', COUNT(*) FROM participant_programs
UNION ALL
SELECT 'blockers (all)', COUNT(*) FROM blockers
UNION ALL
SELECT 'project_members (all)', COUNT(*) FROM project_members
UNION ALL
SELECT 'v2_document_requirements (all)', COUNT(*) FROM v2_document_requirements
UNION ALL
SELECT 'v2_sessions (all)', COUNT(*) FROM v2_sessions
UNION ALL
SELECT 'v2_kpis (all)', COUNT(*) FROM v2_kpis
UNION ALL
SELECT 'v2_kpi_progress (all)', COUNT(*) FROM v2_kpi_progress
UNION ALL
SELECT 'v2_events (all)', COUNT(*) FROM v2_events
UNION ALL
SELECT 'error_logs (all)', COUNT(*) FROM error_logs
ORDER BY table_name;

-- Super Admin check
SELECT '=== SUPER ADMIN ===' AS info;
SELECT cid, name, email, role FROM contacts WHERE role = 'super_admin' AND deleted = 0;
