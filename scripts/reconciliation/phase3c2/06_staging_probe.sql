-- Read-only environment probe — is this staging or production?
SELECT current_database() AS db_name,
       current_user AS db_user,
       inet_server_addr() AS server_addr,
       version() AS server_version,
       NOW() AS checked_at;

-- Contact universe (small vs production's 576)
SELECT role, COUNT(*)::int AS contacts
FROM contacts
WHERE deleted = 0
GROUP BY role
ORDER BY role;

-- Programs (production has exactly 1: Bootcamp pre-entrepreneurial)
SELECT id, name, status, assigned_pm_id
FROM v2_programs
ORDER BY created_at DESC
LIMIT 10;

-- Key 3C state: facilitators assigned? Josias profile? contact_roles?
SELECT COUNT(*)::int AS program_staff_rows FROM v2_program_staff;
SELECT COUNT(*)::int AS contact_roles_rows FROM contact_roles;
SELECT cid, name, role, access_profile_id FROM contacts
WHERE cid IN ('USER_6B8031C5115','USR_27C27C00379B','USR_EDD56CB0DBA6','USR_CF9AAD183C6C','USR_E971591D0D3F');

-- Schema state: are the Track 2/3 columns already present?
SELECT table_name, column_name
FROM information_schema.columns
WHERE (table_name, column_name) IN (
  ('v2_submissions','version_number'), ('v2_submissions','updated_at'),
  ('v2_followups','participant_id'), ('v2_attendance','kpi_id'),
  ('v2_programs','is_archived'), ('v2_sessions','handler_id'),
  ('contact_roles','capability_overrides'), ('contacts','access_profile_id')
)
ORDER BY table_name, column_name;
