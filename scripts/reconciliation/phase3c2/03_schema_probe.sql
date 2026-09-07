-- Read-only schema verification for the 3C-2 write (no data written here).
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('v2_program_staff','contact_roles','contact_timeline','permission_audit_log')
ORDER BY table_name, ordinal_position;

SELECT id, name, is_active FROM access_profiles WHERE name = 'Program Manager';

SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'v2_program_staff'::regclass;

SELECT COUNT(*) AS staff_rows FROM v2_program_staff;
SELECT COUNT(*) AS roles_rows FROM contact_roles;
