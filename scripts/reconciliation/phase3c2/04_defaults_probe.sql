-- Read-only: column defaults + unique indexes for the write.
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_name IN ('v2_program_staff','contact_roles','contact_timeline','permission_audit_log')
  AND column_default IS NOT NULL
ORDER BY table_name, ordinal_position;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('v2_program_staff','contact_roles')
ORDER BY tablename, indexname;
