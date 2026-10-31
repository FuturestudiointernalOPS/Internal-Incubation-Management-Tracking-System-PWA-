-- Préparé pendant la phase 0 statique ; 11 SELECT exécutés le 22 octobre 2026.
-- .env.local autorisé explicitement pour ce seul audit, transaction READ ONLY.
-- La base consultée ne doit pas être requalifiée en staging. Aucune migration.
-- Toute réutilisation exige une destination autorisée et une session lecture seule.
-- Métadonnées seulement : aucune ligne métier, aucun secret.

SELECT current_database() AS database_name,
       current_user AS database_role,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('server_version') AS server_version;

SELECT rolname, rolsuper, rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname = current_user;

SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE 'v2_%'
       OR table_name LIKE 'lms_%'
       OR table_name LIKE 'venture%'
       OR table_name LIKE 'organization%'
       OR table_name LIKE 'platform_form_%'
       OR table_name IN ('contacts', 'users', 'user_sessions', 'groups',
                         'group_memberships', 'group_membership_events',
                         'participant_programs', 'families', 'contact_groups'))
ORDER BY table_name;

SELECT table_name, ordinal_position, column_name, data_type,
       udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name LIKE 'v2_%'
       OR table_name LIKE 'lms_%'
       OR table_name LIKE 'venture%'
       OR table_name LIKE 'organization%'
       OR table_name LIKE 'platform_form_%'
       OR table_name IN ('contacts', 'users', 'user_sessions', 'groups',
                         'group_memberships', 'group_membership_events',
                         'participant_programs', 'families', 'contact_groups'))
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, k.conname AS constraint_name,
       k.contype AS constraint_type,
       pg_catalog.pg_get_constraintdef(k.oid) AS definition
FROM pg_catalog.pg_constraint k
JOIN pg_catalog.pg_class c ON c.oid = k.conrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND (c.relname LIKE 'v2_%' OR c.relname LIKE 'lms_%'
       OR c.relname LIKE 'venture%' OR c.relname LIKE 'organization%'
       OR c.relname LIKE 'platform_form_%'
       OR c.relname IN ('contacts', 'users', 'user_sessions', 'groups',
                        'group_memberships', 'group_membership_events',
                        'participant_programs', 'families', 'contact_groups'))
ORDER BY c.relname, k.conname;

SELECT tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND (tablename LIKE 'v2_%' OR tablename LIKE 'lms_%'
       OR tablename LIKE 'venture%' OR tablename LIKE 'organization%'
       OR tablename LIKE 'platform_form_%'
       OR tablename IN ('user_sessions', 'groups', 'group_memberships',
                        'participant_programs'))
ORDER BY tablename, indexname;

SELECT c.relname AS table_name, c.relrowsecurity, c.relforcerowsecurity
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  AND (c.relname LIKE 'v2_%' OR c.relname LIKE 'lms_%'
       OR c.relname LIKE 'venture%' OR c.relname LIKE 'organization%')
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND (tablename LIKE 'v2_%' OR tablename LIKE 'lms_%'
       OR tablename LIKE 'venture%' OR tablename LIKE 'organization%')
ORDER BY tablename, policyname;

SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_catalog.pg_get_triggerdef(t.oid) AS definition
FROM pg_catalog.pg_trigger t
JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND (c.relname LIKE 'v2_%' OR c.relname LIKE 'lms_%'
       OR c.relname LIKE 'venture%' OR c.relname LIKE 'organization%'
       OR c.relname IN ('user_sessions', 'groups', 'participant_programs'))
ORDER BY c.relname, t.tgname;

-- Recherche complémentaire de noms de tables et colonnes liés aux cohortes.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ~* '(cohort|batch|session_version)'
ORDER BY table_name;

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ~* '(cohort|batch)'
ORDER BY table_name, column_name;
