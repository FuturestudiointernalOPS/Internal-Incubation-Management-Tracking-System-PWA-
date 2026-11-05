-- Metadata audit only. No application rows, migrations, initDb or writes.
SET default_transaction_read_only = on;
SELECT current_setting('transaction_read_only') AS read_only;
SELECT t.table_name, t.column_name, t.data_type, t.is_nullable
FROM information_schema.columns t
WHERE t.table_schema = 'public'
  AND (t.table_name LIKE '%investor%'
    OR t.table_name LIKE '%deal_flow%'
    OR t.table_name LIKE '%intro%'
    OR t.table_name LIKE '%legal%'
    OR t.table_name LIKE '%metric%setting%'
    OR t.table_name IN ('investment_pipeline', 'relationship_workspaces', 'ventures'))
ORDER BY t.table_name, t.ordinal_position;
SELECT c.conname AS constraint_name, r.relname AS table_name, c.contype AS type,
       c.convalidated AS validated, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class r ON r.oid = c.conrelid
JOIN pg_namespace n ON n.oid = r.relnamespace
WHERE n.nspname = 'public'
  AND r.relname IN ('investor_profiles', 'investment_pipeline', 'relationship_workspaces',
    'investor_activity_log', 'introduction_requests', 'investor_invitations')
ORDER BY r.relname, c.conname;
SELECT r.relname AS table_name, r.relrowsecurity AS rls_enabled,
       r.relforcerowsecurity AS rls_forced
FROM pg_class r JOIN pg_namespace n ON n.oid = r.relnamespace
WHERE n.nspname = 'public' AND r.relkind = 'r'
  AND r.relname IN ('investor_profiles', 'investment_pipeline', 'relationship_workspaces',
    'investor_activity_log', 'introduction_requests', 'investor_invitations')
ORDER BY r.relname;
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('investor_profiles', 'investment_pipeline', 'relationship_workspaces',
    'investor_activity_log', 'introduction_requests', 'investor_invitations')
ORDER BY tablename, policyname;
SELECT r.relname AS table_name, t.tgname AS trigger_name,
       t.tgenabled AS enabled, p.proname AS function_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class r ON r.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = r.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND r.relname IN ('investor_profiles', 'investment_pipeline', 'relationship_workspaces',
    'investor_activity_log', 'introduction_requests', 'investor_invitations')
ORDER BY r.relname, t.tgname;
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('investor_profiles', 'investment_pipeline', 'relationship_workspaces',
    'investor_activity_log', 'introduction_requests', 'investor_invitations')
ORDER BY table_name, grantee, privilege_type;
SELECT flag_key, is_enabled
FROM feature_flags
WHERE flag_key LIKE '%investor%' OR flag_key IN ('investment_module', 'data_room')
ORDER BY flag_key;
