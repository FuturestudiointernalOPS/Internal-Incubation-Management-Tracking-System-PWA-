SELECT current_database() AS database_name,
       (SELECT count(*) FROM public.contacts) AS contacts,
       (SELECT count(*) FROM public.ventures) AS ventures;

SELECT table_name,
       to_regclass('public.' || table_name)::text AS relation
FROM (VALUES
  ('organizations'),
  ('organization_contracts'),
  ('organization_modules'),
  ('organization_memberships'),
  ('organization_roles'),
  ('organization_role_assignments')
) AS expected(table_name);

SELECT t.tgname AS trigger_name,
       t.tgenabled AS enabled,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'organizations'
  AND t.tgname = 'wl_organizations_preparation';
