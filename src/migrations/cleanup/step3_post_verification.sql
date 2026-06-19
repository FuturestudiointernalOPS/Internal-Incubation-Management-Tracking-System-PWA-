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
SELECT 'v2_events', COUNT(*) FROM v2_events
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

-- Foreign key integrity
SELECT '=== FOREIGN KEY INTEGRITY ===' AS info;

-- Check that retained users can still log in (they have active status)
SELECT 'Users with non-active status' AS check_name, COUNT(*) AS count
FROM contacts WHERE deleted = 0 AND status != 'active' AND role != 'super_admin';
