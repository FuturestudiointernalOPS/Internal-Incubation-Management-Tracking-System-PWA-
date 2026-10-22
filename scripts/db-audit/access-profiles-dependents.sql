-- access_profiles — WHAT STILL DEPENDS ON IT? (read-only).
--
-- The one-time `drop-access-profiles-v1` migration fails on this database with
--   cannot drop table access_profiles because other objects depend on it
-- which means a view, a foreign key or another relation still references the
-- retired template layer. This query names them. It changes nothing.
--
-- Do NOT switch the drop to CASCADE before reading this: CASCADE would remove
-- the dependent object, and a view someone still reads would disappear.

SELECT 'vue / règle' AS type,
       n.nspname AS schema,
       c.relname AS objet
FROM pg_depend d
JOIN pg_rewrite r ON r.oid = d.objid
JOIN pg_class c ON c.oid = r.ev_class
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_class s ON s.oid = d.refobjid
WHERE s.relname = 'access_profiles'
  AND c.oid <> s.oid

UNION ALL

SELECT 'clé étrangère' AS type,
       n.nspname AS schema,
       c.relname || ' → ' || con.conname AS objet
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_class s ON s.oid = con.confrelid
WHERE s.relname = 'access_profiles'

UNION ALL

SELECT 'autre dépendance' AS type,
       n.nspname AS schema,
       c.relname AS objet
FROM pg_depend d
JOIN pg_class c ON c.oid = d.objid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_class s ON s.oid = d.refobjid
WHERE s.relname = 'access_profiles'
  AND c.oid <> s.oid
  AND d.deptype = 'n'

ORDER BY 1, 3;
