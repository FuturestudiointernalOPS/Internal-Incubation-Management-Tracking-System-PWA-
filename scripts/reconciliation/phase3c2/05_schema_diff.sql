-- Read-only schema diff: which tables/columns/constraints/indexes from the
-- app's own migration list (api/admin/run-migration) are MISSING in production.
-- 1 = present, 0 = missing.

-- Tables that the migration statements target
SELECT t.tbl,
       CASE WHEN to_regclass(t.tbl) IS NOT NULL THEN 1 ELSE 0 END AS table_present
FROM (VALUES ('v2_sessions'),('v2_document_requirements'),('v2_programs'),
             ('v2_submissions'),('v2_followups'),('v2_attendance'),
             ('v2_teams'),('v2_deliverables'),('v2_groups'),('families'),
             ('v2_knowledge_bank'),('v2_events'),('v2_weekly_reports'),
             ('access_profiles'),('access_profile_capabilities'),
             ('role_access_profile_defaults'),('user_capabilities'),
             ('user_capability_restrictions'),('role_capabilities'),
             ('group_capabilities'),('permission_audit_log'),('contact_roles'),
             ('contact_timeline'),('responsibilities'),('user_responsibilities'),
             ('user_groups'),('v2_program_staff'),('participant_programs'),
             ('v2_teams_members')) AS t(tbl)
ORDER BY t.tbl;

-- Columns targeted by the migration list (table, column, present?)
SELECT c.table_name, c.column_name, 1 AS present
FROM information_schema.columns c
WHERE (c.table_name, c.column_name) IN (
  ('v2_sessions','description'),('v2_sessions','status'),('v2_sessions','weight'),
  ('v2_sessions','scheduled_date'),('v2_sessions','end_date'),('v2_sessions','start_time'),
  ('v2_sessions','end_time'),('v2_sessions','assignment_type'),('v2_sessions','task_type'),
  ('v2_sessions','handler_id'),('v2_sessions','handler_name'),('v2_sessions','kpi_ids'),
  ('v2_sessions','notes'),('v2_sessions','extra_materials'),('v2_sessions','version'),
  ('v2_sessions','timezone'),
  ('v2_document_requirements','session_id'),('v2_document_requirements','allowed_format'),
  ('v2_document_requirements','weight'),('v2_document_requirements','kpi_ids'),
  ('v2_document_requirements','week_number'),
  ('v2_programs','concept_note'),('v2_programs','vision'),('v2_programs','objectives'),
  ('v2_programs','program_type'),('v2_programs','visibility'),('v2_programs','participant_limit'),
  ('v2_programs','registration_window'),('v2_programs','language'),('v2_programs','note_id'),
  ('v2_programs','assigned_assistant_id'),('v2_programs','is_archived'),
  ('v2_programs','materials'),('v2_programs','evaluation_config'),('v2_programs','grading_mode'),
  ('v2_programs','slug'),('v2_programs','expected_outcomes'),('v2_programs','success_metrics'),
  ('v2_programs','facilitator_default_permissions'),('v2_programs','facilitator_scope'),
  ('v2_submissions','version_number'),('v2_submissions','supporting_url'),
  ('v2_submissions','review_action'),('v2_submissions','rejection_reason'),
  ('v2_submissions','document_id'),('v2_submissions','team_id'),('v2_submissions','score'),
  ('v2_submissions','evaluation_score'),('v2_submissions','updated_at'),
  ('v2_followups','participant_id'),('v2_followups','submission_id'),
  ('v2_followups','scheduled_at'),('v2_followups','duration_minutes'),
  ('v2_followups','meeting_link'),('v2_followups','status'),('v2_followups','notes'),
  ('v2_attendance','kpi_id'),
  ('contacts','access_profile_id'),('contacts','deleted'),('contacts','archived_at'),
  ('contact_roles','capability_overrides'),('contact_roles','scope'),
  ('v2_program_staff','permissions'),('v2_program_staff','updated_at'),
  ('user_groups','role_in_group')
)
ORDER BY c.table_name, c.column_name;

-- Constraints and indexes from the migration list
SELECT 'v2_submissions_status_check' AS obj,
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v2_submissions_status_check')::int AS present
UNION ALL
SELECT 'v2_programs_grading_mode_check',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'v2_programs_grading_mode_check')::int
UNION ALL
SELECT 'idx_v2_submissions_participant_deliverable',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_v2_submissions_participant_deliverable')::int
UNION ALL
SELECT 'idx_v2_submissions_version',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_v2_submissions_version')::int
UNION ALL
SELECT 'idx_v2_followups_participant',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_v2_followups_participant')::int
UNION ALL
SELECT 'idx_v2_followups_submission',
       EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_v2_followups_submission')::int;
