-- ============================================================================
-- STEP 2: DATA CLEANUP
-- ONLY RUN THIS AFTER:
--   1. Backup completed and verified (Step 0)
--   2. Pre-cleanup counts reviewed (Step 1)
-- ============================================================================

BEGIN;

-- Identify user IDs to retain
CREATE TEMP TABLE retained_users AS
SELECT cid FROM contacts WHERE email ILIKE '%@epitech.eu' AND deleted = 0;

-- Also retain the super admin
INSERT INTO retained_users
SELECT cid FROM contacts WHERE role = 'super_admin' AND deleted = 0
ON CONFLICT DO NOTHING;

-- Identify user IDs to delete
CREATE TEMP TABLE deleted_users AS
SELECT cid FROM contacts
WHERE cid NOT IN (SELECT cid FROM retained_users)
AND deleted = 0;

-- ============================================================================
-- 1. DELETE SUBMISSIONS
-- ============================================================================
DELETE FROM v2_submissions WHERE participant_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 2. DELETE PARTICIPANT PROGRAM RELATIONSHIPS
-- ============================================================================
DELETE FROM participant_programs WHERE participant_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 3. DELETE BLOCKERS (for tasks owned by deleted users)
-- ============================================================================
DELETE FROM blockers WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users));

-- ============================================================================
-- 4. DELETE TASKS
-- ============================================================================
DELETE FROM task_assignment_log WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users));
DELETE FROM task_audit_logs WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users));
DELETE FROM project_approval_requests WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users));
DELETE FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 5. DELETE PROJECT MEMBERS
-- ============================================================================
DELETE FROM project_members WHERE user_cid IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 6. DELETE PROJECTS (owned by deleted users — reassign orphaned projects to super admin)
-- ============================================================================
-- First, reassign any projects owned by deleted users to the super admin
UPDATE v2_projects SET owner_id = (SELECT cid FROM contacts WHERE role = 'super_admin' LIMIT 1)
WHERE owner_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 7. DELETE MESSAGES
-- ============================================================================
DELETE FROM v2_messages WHERE sender_id IN (SELECT cid FROM deleted_users);
DELETE FROM v2_messages WHERE recipient_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 8. DELETE NOTIFICATIONS
-- ============================================================================
DELETE FROM v2_notifications WHERE recipient_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 9. DELETE OPERATIONAL REPORTS
-- ============================================================================
DELETE FROM v2_op_reports WHERE user_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 10. DELETE PROGRAMS (all — since this is a fresh production start)
-- ============================================================================
-- Delete program-related data first
DELETE FROM v2_kpi_progress WHERE session_id IN (SELECT id FROM v2_sessions WHERE program_id IS NOT NULL);
DELETE FROM v2_kpis WHERE program_id IS NOT NULL;
DELETE FROM v2_sessions WHERE program_id IS NOT NULL;
DELETE FROM v2_document_requirements WHERE program_id IS NOT NULL;
DELETE FROM v2_events WHERE program_id IS NOT NULL;
DELETE FROM v2_program_staff WHERE program_id IS NOT NULL;
DELETE FROM v2_submissions WHERE program_id IS NOT NULL;
DELETE FROM participant_programs WHERE program_id IS NOT NULL;
DELETE FROM v2_programs;

-- ============================================================================
-- 11. DELETE CONTACTS (non-epitech users)
-- ============================================================================
DELETE FROM contacts WHERE cid IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 12. CLEAN UP USER SESSIONS
-- ============================================================================
DELETE FROM user_sessions WHERE user_cid IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 13. CLEAN UP PASSWORD SETUP TOKENS
-- ============================================================================
DELETE FROM password_setup_tokens WHERE user_cid IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 14. CLEAN UP v2_NOTIFICATIONS WITH NO RECIPIENT
-- ============================================================================
DELETE FROM v2_notifications WHERE recipient_id NOT IN (SELECT cid FROM contacts WHERE deleted = 0);

-- ============================================================================
-- 15. CLEAN UP v2_EVENTS WITH NO PROGRAM
-- ============================================================================
DELETE FROM v2_events WHERE program_id IS NULL;

-- Clean up temp tables
DROP TABLE IF EXISTS retained_users;
DROP TABLE IF EXISTS deleted_users;

COMMIT;
