-- ============================================================================
-- STEP 1: PRE-CLEANUP RECORD COUNTS
-- Run this FIRST to see what will be deleted.
-- ============================================================================

-- Users to retain (@epitech.eu)
SELECT '=== RETAINED USERS (@epitech.eu) ===' AS info;
SELECT cid, name, email, role, group_name FROM contacts WHERE email ILIKE '%@epitech.eu' AND deleted = 0;

-- Users to delete (non-@epitech.eu)
SELECT '=== USERS TO BE DELETED ===' AS info;
SELECT cid, name, email, role, group_name FROM contacts WHERE email NOT ILIKE '%@epitech.eu' AND deleted = 0;

-- Counts of records that will be affected
SELECT '=== RECORD COUNTS TO BE REMOVED ===' AS info;

SELECT 'contacts (non-epitech)' AS table_name, COUNT(*) AS count FROM contacts WHERE email NOT ILIKE '%@epitech.eu' AND deleted = 0
UNION ALL
SELECT 'v2_programs (all)', COUNT(*) FROM v2_programs
UNION ALL
SELECT 'v2_submissions (all)', COUNT(*) FROM v2_submissions
UNION ALL
SELECT 'v2_projects (all)', COUNT(*) FROM v2_projects
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
SELECT 'kpi_progress (all)', COUNT(*) FROM kpi_progress
UNION ALL
SELECT 'v2_standups (all)', COUNT(*) FROM v2_standups
UNION ALL
SELECT 'v2_retros (all)', COUNT(*) FROM v2_retros
UNION ALL
SELECT 'v2_checkins (all)', COUNT(*) FROM v2_checkins
UNION ALL
SELECT 'v2_reflections (all)', COUNT(*) FROM v2_reflections
UNION ALL
SELECT 'v2_weekly_reports (all)', COUNT(*) FROM v2_weekly_reports
UNION ALL
SELECT 'v2_attendance (all)', COUNT(*) FROM v2_attendance
UNION ALL
SELECT 'v2_followups (all)', COUNT(*) FROM v2_followups
UNION ALL
SELECT 'v2_groups (all)', COUNT(*) FROM v2_groups
UNION ALL
SELECT 'v2_teams (all)', COUNT(*) FROM v2_teams
UNION ALL
SELECT 'v2_knowledge_bank (all)', COUNT(*) FROM v2_knowledge_bank
UNION ALL
SELECT 'forms (all)', COUNT(*) FROM forms
UNION ALL
SELECT 'form_responses (all)', COUNT(*) FROM form_responses
UNION ALL
SELECT 'campaigns (all)', COUNT(*) FROM campaigns
UNION ALL
SELECT 'activity_logs (all)', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'audit_log (all)', COUNT(*) FROM audit_log
UNION ALL
SELECT 'user_sessions (all)', COUNT(*) FROM user_sessions
ORDER BY table_name;

-- Super Admin check
SELECT '=== SUPER ADMIN ===' AS info;
SELECT cid, name, email, role FROM contacts WHERE role = 'super_admin' AND deleted = 0;
