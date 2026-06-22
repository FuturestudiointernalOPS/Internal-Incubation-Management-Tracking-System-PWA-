-- ============================================================================
-- STEP 2: DATA CLEANUP (Schema-verified against actual DB)
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
-- 2. DELETE PARTICIPANT PROGRAMS
-- ============================================================================
DELETE FROM participant_programs WHERE participant_id IN (SELECT cid FROM deleted_users);
DELETE FROM participant_program_audit WHERE participant_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 3. DELETE RITUAL DATA (standups, retros, checkins, reflections, attendance)
-- ============================================================================
DELETE FROM v2_standups WHERE participant_id IN (SELECT cid FROM deleted_users);
DELETE FROM v2_retros WHERE participant_id IN (SELECT cid FROM deleted_users);
DELETE FROM v2_checkins WHERE participant_id IN (SELECT cid FROM deleted_users);
DELETE FROM v2_reflections WHERE participant_id IN (SELECT cid FROM deleted_users);
DELETE FROM v2_attendance WHERE participant_id IN (SELECT cid FROM deleted_users);
DELETE FROM v2_weekly_reports WHERE teacher_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 4. DELETE BLOCKERS
-- ============================================================================
DELETE FROM blockers WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users));

-- ============================================================================
-- 5. DELETE TASKS + related
-- ============================================================================
DELETE FROM task_assignment_log WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users));
DELETE FROM project_approval_requests WHERE task_id IN (SELECT id FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users));
DELETE FROM tasks WHERE user_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 6. DELETE PROJECT MEMBERS / STAFF
-- ============================================================================
DELETE FROM project_members WHERE user_cid IN (SELECT cid FROM deleted_users);
DELETE FROM v2_project_staff WHERE staff_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 7. REASSIGN PROJECTS (deleted owner → super admin)
-- ============================================================================
UPDATE v2_projects SET owner_id = (SELECT cid FROM contacts WHERE role = 'super_admin' LIMIT 1)
WHERE owner_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 8. DELETE MESSAGES
-- ============================================================================
DELETE FROM v2_messages WHERE sender_id IN (SELECT cid FROM deleted_users);
DELETE FROM v2_messages WHERE recipient_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 9. DELETE NOTIFICATIONS
-- ============================================================================
DELETE FROM v2_notifications WHERE recipient_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 10. DELETE OPERATIONAL REPORTS
-- ============================================================================
DELETE FROM v2_op_reports WHERE user_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 11. DELETE GROUPS / TEAMS
-- ============================================================================
DELETE FROM v2_teams WHERE handler_id IN (SELECT cid FROM deleted_users);
DELETE FROM v2_teams WHERE leader_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 12. DELETE FORMS / RESPONSES
-- ============================================================================
DELETE FROM form_responses WHERE cid IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 13. DELETE CAMPAIGNS (linked to deleted users via form_responses)
-- ============================================================================
DELETE FROM campaign_steps WHERE campaign_id IN (SELECT id FROM campaigns);
DELETE FROM campaign_contacts WHERE campaign_id IN (SELECT id FROM campaigns);
DELETE FROM campaigns;

-- ============================================================================
-- 14. DELETE PROGRAMS (all)
-- ============================================================================
DELETE FROM kpi_progress;
DELETE FROM v2_kpis WHERE program_id IS NOT NULL;
DELETE FROM v2_sessions WHERE program_id IS NOT NULL;
DELETE FROM v2_document_requirements WHERE program_id IS NOT NULL;
DELETE FROM v2_followups WHERE program_id IS NOT NULL;
DELETE FROM v2_program_staff WHERE program_id IS NOT NULL;
DELETE FROM v2_submissions WHERE program_id IS NOT NULL;
DELETE FROM v2_participants WHERE program_id IS NOT NULL;
DELETE FROM participant_programs WHERE program_id IS NOT NULL;
DELETE FROM v2_groups WHERE program_id IS NOT NULL;
DELETE FROM v2_programs;

-- ============================================================================
-- 15. DELETE KNOWLEDGE BANK (all)
-- ============================================================================
DELETE FROM v2_knowledge_attachments;
DELETE FROM v2_knowledge_bank;

-- ============================================================================
-- 16. DELETE CONTACTS (non-epitech)
-- ============================================================================
DELETE FROM contacts WHERE cid IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 17. CLEAN SESSIONS / TOKENS
-- ============================================================================
DELETE FROM user_sessions WHERE user_cid IN (SELECT cid FROM deleted_users);
DELETE FROM password_setup_tokens WHERE user_cid IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 18. CLEAN LOGS
-- ============================================================================
DELETE FROM activity_logs WHERE user_identity IN (SELECT cid FROM deleted_users);
DELETE FROM audit_log WHERE user_id IN (SELECT cid FROM deleted_users);

-- ============================================================================
-- 19. CLEAN ORPHANED RECORDS
-- ============================================================================
DELETE FROM v2_notifications WHERE recipient_id NOT IN (SELECT cid FROM contacts WHERE deleted = 0);
DELETE FROM v2_messages WHERE sender_id NOT IN (SELECT cid FROM contacts WHERE deleted = 0);
DELETE FROM v2_messages WHERE recipient_id NOT IN (SELECT cid FROM contacts WHERE deleted = 0);
DELETE FROM v2_internal_signals WHERE target_id NOT IN (SELECT cid FROM contacts WHERE deleted = 0);

-- Clean up temp tables
DROP TABLE IF EXISTS retained_users;
DROP TABLE IF EXISTS deleted_users;

COMMIT;
