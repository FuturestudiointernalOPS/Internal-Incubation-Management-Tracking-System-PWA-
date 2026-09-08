-- ============================================================================
-- STEP 3: POST-CLEANUP VERIFICATION
-- Run AFTER step 2 to confirm cleanup was successful.
-- ============================================================================

-- Remaining users
SELECT '=== RETAINED USERS ===' AS info;
SELECT cid, name, email, role, group_name FROM contacts WHERE deleted = 0 ORDER BY role, name;

-- Record counts after cleanup
SELECT '=== POST-CLEANUP RECORD COUNTS ===' AS info;

SELECT 'contacts' AS table_name, COUNT(*) AS remaining FROM contacts WHERE deleted = 0
UNION ALL
SELECT 'v2_programs', COUNT(*) FROM v2_programs
UNION ALL
SELECT 'v2_submissions', COUNT(*) FROM v2_submissions
UNION ALL
SELECT 'v2_projects', COUNT(*) FROM v2_projects
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'v2_messages', COUNT(*) FROM v2_messages
UNION ALL
SELECT 'v2_notifications', COUNT(*) FROM v2_notifications
UNION ALL
SELECT 'v2_op_reports', COUNT(*) FROM v2_op_reports
UNION ALL
SELECT 'participant_programs', COUNT(*) FROM participant_programs
UNION ALL
SELECT 'blockers', COUNT(*) FROM blockers
UNION ALL
SELECT 'project_members', COUNT(*) FROM project_members
UNION ALL
SELECT 'v2_document_requirements', COUNT(*) FROM v2_document_requirements
UNION ALL
SELECT 'v2_sessions', COUNT(*) FROM v2_sessions
UNION ALL
SELECT 'v2_kpis', COUNT(*) FROM v2_kpis
UNION ALL
SELECT 'kpi_progress', COUNT(*) FROM kpi_progress
UNION ALL
SELECT 'v2_standups', COUNT(*) FROM v2_standups
UNION ALL
SELECT 'v2_retros', COUNT(*) FROM v2_retros
UNION ALL
SELECT 'v2_checkins', COUNT(*) FROM v2_checkins
UNION ALL
SELECT 'v2_reflections', COUNT(*) FROM v2_reflections
UNION ALL
SELECT 'v2_weekly_reports', COUNT(*) FROM v2_weekly_reports
UNION ALL
SELECT 'v2_attendance', COUNT(*) FROM v2_attendance
UNION ALL
SELECT 'v2_followups', COUNT(*) FROM v2_followups
UNION ALL
SELECT 'v2_groups', COUNT(*) FROM v2_groups
UNION ALL
SELECT 'v2_teams', COUNT(*) FROM v2_teams
UNION ALL
SELECT 'v2_knowledge_bank', COUNT(*) FROM v2_knowledge_bank
UNION ALL
SELECT 'forms', COUNT(*) FROM forms
UNION ALL
SELECT 'form_responses', COUNT(*) FROM form_responses
UNION ALL
SELECT 'campaigns', COUNT(*) FROM campaigns
UNION ALL
SELECT 'activity_logs', COUNT(*) FROM activity_logs
UNION ALL
SELECT 'audit_log', COUNT(*) FROM audit_log
UNION ALL
SELECT 'user_sessions', COUNT(*) FROM user_sessions
ORDER BY table_name;

-- Check for orphaned records
SELECT '=== ORPHANED RECORD CHECKS ===' AS info;

-- Tasks with no valid user
SELECT 'Tasks with no valid user' AS check_name, COUNT(*) AS orphans
FROM tasks t LEFT JOIN contacts c ON t.user_id = c.cid
WHERE c.cid IS NULL;

-- Project members with no valid user
SELECT 'Project members with no valid user' AS check_name, COUNT(*) AS orphans
FROM project_members pm LEFT JOIN contacts c ON pm.user_cid = c.cid
WHERE c.cid IS NULL;

-- v2_submissions with no valid participant
SELECT 'Submissions with no valid participant' AS check_name, COUNT(*) AS orphans
FROM v2_submissions s LEFT JOIN contacts c ON s.participant_id = c.cid
WHERE c.cid IS NULL;

-- v2_op_reports with no valid user
SELECT 'Op reports with no valid user' AS check_name, COUNT(*) AS orphans
FROM v2_op_reports r LEFT JOIN contacts c ON r.user_id = c.cid
WHERE c.cid IS NULL;

-- v2_notifications with no valid recipient
SELECT 'Notifications with no valid recipient' AS check_name, COUNT(*) AS orphans
FROM v2_notifications n LEFT JOIN contacts c ON n.recipient_id = c.cid
WHERE c.cid IS NULL;

-- Blockers with no valid task
SELECT 'Blockers with no valid task' AS check_name, COUNT(*) AS orphans
FROM blockers b LEFT JOIN tasks t ON b.task_id = t.id
WHERE t.id IS NULL;

-- v2_messages with no sender
SELECT 'Messages with no valid sender' AS check_name, COUNT(*) AS orphans
FROM v2_messages m LEFT JOIN contacts c ON m.sender_id = c.cid
WHERE c.cid IS NULL AND m.sender_id IS NOT NULL;

-- v2_standups with no valid user
SELECT 'Standups with no valid user' AS check_name, COUNT(*) AS orphans
FROM v2_standups s LEFT JOIN contacts c ON s.user_id = c.cid
WHERE c.cid IS NULL;

-- Foreign key integrity
SELECT '=== FOREIGN KEY INTEGRITY ===' AS info;

-- Check that retained users can still log in (they have active status)
SELECT 'Users with non-active status' AS check_name, COUNT(*) AS count
FROM contacts WHERE deleted = 0 AND status != 'active' AND role != 'super_admin';
