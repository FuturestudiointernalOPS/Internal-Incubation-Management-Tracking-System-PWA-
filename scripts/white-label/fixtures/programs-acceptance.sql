-- Run only through test-programs-migrations.py in its isolated Docker database.
-- All fixture business actions are rolled back at the end.
BEGIN;
SET LOCAL plpgsql.check_asserts = ON;
CREATE FUNCTION pg_temp.expect_failure(statement TEXT, expected_state TEXT, message_fragment TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE failed BOOLEAN := FALSE;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    failed := TRUE;
    IF SQLSTATE <> expected_state OR position(message_fragment IN SQLERRM) = 0 THEN
      RAISE EXCEPTION 'Unexpected rejection: state %, message %', SQLSTATE, SQLERRM;
    END IF;
  END;
  IF NOT failed THEN RAISE EXCEPTION 'Expected rejection did not occur: %', statement; END IF;
END $$;

DO $$ BEGIN
  ASSERT (SELECT (to_jsonb(p) - 'organization_id') = b.snapshot AND p.organization_id IS NULL
    FROM v2_programs p CROSS JOIN wl_synthetic_baseline b WHERE b.kind = 'program'), 'Legacy programme changed';
  ASSERT (SELECT (to_jsonb(s) - 'active_organization_id') = b.snapshot AND s.active_organization_id IS NULL
    FROM user_sessions s CROSS JOIN wl_synthetic_baseline b WHERE b.kind = 'session'), 'Legacy session changed';
END $$;

-- Existing INSERT shape omits the new owner and gets the platform default.
INSERT INTO v2_programs (id, name) VALUES
  ('22222222-2222-4222-8222-222222222222', 'Scoped synthetic programme'),
  ('33333333-3333-4333-8333-333333333333', 'Other synthetic programme');
DO $$ BEGIN
  ASSERT (SELECT organization_id = '00000000-0000-4000-8000-000000000001'::UUID
    FROM v2_programs WHERE id = '22222222-2222-4222-8222-222222222222'), 'Legacy INSERT lost its default';
END $$;

SET LOCAL app.actor_person_id = 'SYNTH-PERSON';
SET LOCAL app.request_id = 'synthetic-request';
INSERT INTO organizations (id, code, name) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'synthetic-client', 'Synthetic Client');
SELECT pg_temp.expect_failure(
  $$UPDATE organizations SET status = 'active' WHERE code = 'synthetic-client'$$,
  'P0001', 'Client activation blocked');
SELECT pg_temp.expect_failure(
  $$INSERT INTO v2_programs (id, name, organization_id) VALUES
    ('44444444-4444-4444-8444-444444444444', 'Blocked client programme', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,
  'P0001', 'Client programme writes blocked');

INSERT INTO organization_memberships (id, organization_id, person_id, status) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '00000000-0000-4000-8000-000000000001', 'SYNTH-PERSON', 'active'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'SYNTH-PERSON', 'active');
INSERT INTO organization_roles (id, organization_id, template_key, label) VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '00000000-0000-4000-8000-000000000001', 'program_manager', 'Synthetic Manager'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'program_manager', 'Synthetic Client Manager');
INSERT INTO organization_role_assignments (id, organization_id, membership_id, role_id, scope_type, scope_id) VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', '00000000-0000-4000-8000-000000000001',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'program', '22222222-2222-4222-8222-222222222222');

SELECT pg_temp.expect_failure(
  $$INSERT INTO organization_role_assignments (organization_id, membership_id, role_id, scope_type, scope_id) VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
     'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'program', '22222222-2222-4222-8222-222222222222')$$,
  'P0001', 'Programme scope must belong');
SELECT pg_temp.expect_failure(
  $$INSERT INTO organization_role_assignments (organization_id, membership_id, role_id, scope_type) VALUES
    ('00000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
     'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'organization')$$,
  'P0001', 'Role assignment exceeds');

-- Prove FK enforcement without relying on the validation trigger.
ALTER TABLE organization_role_assignments DISABLE TRIGGER wl_program_scope;
SELECT pg_temp.expect_failure(
  $$INSERT INTO organization_role_assignments (organization_id, membership_id, role_id, scope_type, scope_id) VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
     'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'program', '22222222-2222-4222-8222-222222222222')$$,
  '23503', 'wl_assignment_program_org_fk');
ALTER TABLE organization_role_assignments ENABLE TRIGGER wl_program_scope;

SELECT pg_temp.expect_failure(
  $$INSERT INTO organization_grants (organization_id, subject_type, subject_id, module, capability, effect, scope_type) VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'membership', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'programs', 'view', 'allow', 'organization')$$,
  'P0001', 'Grant subject must belong');
SELECT pg_temp.expect_failure(
  $$INSERT INTO organization_grants (organization_id, subject_type, subject_id, module, capability, effect, scope_type) VALUES
    ('00000000-0000-4000-8000-000000000001', 'role_assignment', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'programs', 'view', 'allow', 'organization')$$,
  'P0001', 'Allow grant cannot expand');

INSERT INTO organization_grants (id, organization_id, subject_type, subject_id, module, capability, effect, scope_type) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '00000000-0000-4000-8000-000000000001',
   'role_assignment', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'programs', 'view', 'deny', 'organization');

ALTER TABLE organization_grants DISABLE TRIGGER wl_program_scope;
SELECT pg_temp.expect_failure(
  $$INSERT INTO organization_grants (organization_id, subject_type, subject_id, module, capability, effect, scope_type) VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'membership', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'programs', 'view', 'deny', 'organization')$$,
  '23503', 'wl_grant_membership_org_fk');
SELECT pg_temp.expect_failure(
  $$INSERT INTO organization_grants (organization_id, subject_type, subject_id, module, capability, effect, scope_type) VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'role_assignment', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'programs', 'view', 'deny', 'organization')$$,
  '23503', 'wl_grant_assignment_org_fk');
SELECT pg_temp.expect_failure(
  $$INSERT INTO organization_grants (organization_id, subject_type, subject_id, module, capability, effect, scope_type, scope_id) VALUES
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'membership', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'programs', 'view', 'deny', 'program', '22222222-2222-4222-8222-222222222222')$$,
  '23503', 'wl_grant_program_org_fk');
ALTER TABLE organization_grants ENABLE TRIGGER wl_program_scope;

SELECT pg_temp.expect_failure(
  $$UPDATE organization_role_assignments SET scope_id = '33333333-3333-4333-8333-333333333333'$$,
  'P0001', 'immutable');
SELECT pg_temp.expect_failure(
  $$DELETE FROM v2_programs WHERE id = '22222222-2222-4222-8222-222222222222'$$,
  'P0001', 'must be archived');
SELECT pg_temp.expect_failure(
  $$UPDATE v2_programs SET id = '55555555-5555-4555-8555-555555555555' WHERE id = '33333333-3333-4333-8333-333333333333'$$,
  'P0001', 'identity and organization ownership');
SELECT pg_temp.expect_failure(
  $$UPDATE organization_role_templates SET scope_type = 'organization' WHERE key = 'program_manager'$$,
  'P0001', 'immutable');

-- Ordinary legacy edits and deletion of an unreferenced programme still work.
UPDATE v2_programs SET name = 'Updated synthetic programme' WHERE id = '33333333-3333-4333-8333-333333333333';
DELETE FROM v2_programs WHERE id = '33333333-3333-4333-8333-333333333333';

UPDATE organization_memberships SET status = 'ended', ended_at = NOW()
  WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
SELECT pg_temp.expect_failure(
  $$UPDATE organization_memberships SET status = 'active' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$,
  'P0001', 'Ended history cannot be reactivated');
SELECT pg_temp.expect_failure(
  $$UPDATE organization_memberships SET ended_at = NULL WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'$$,
  'P0001', 'Membership end evidence');
UPDATE organization_grants SET revoked_at = NOW();
SELECT pg_temp.expect_failure($$UPDATE organization_grants SET revoked_at = NULL$$, 'P0001', 'Revoked grants');
UPDATE organization_role_assignments SET status = 'ended';
SELECT pg_temp.expect_failure($$UPDATE organization_role_assignments SET status = 'active'$$, 'P0001', 'Ended history cannot be reactivated');

INSERT INTO organization_contracts (organization_id, plan_key, status, signed_at)
  VALUES ('00000000-0000-4000-8000-000000000001', 'synthetic', 'active', NOW());
INSERT INTO organization_modules (organization_id, module_key, status)
  VALUES ('00000000-0000-4000-8000-000000000001', 'programs', 'enabled');
DO $$ DECLARE target_table TEXT; BEGIN
  FOREACH target_table IN ARRAY ARRAY['organizations', 'organization_contracts',
    'organization_modules', 'organization_memberships', 'organization_roles',
    'organization_role_assignments', 'organization_grants'] LOOP
    PERFORM pg_temp.expect_failure(format('DELETE FROM public.%I', target_table), 'P0001', 'history cannot be deleted');
  END LOOP;
END $$;
SELECT pg_temp.expect_failure($$TRUNCATE organization_contracts$$, 'P0001', 'history cannot be deleted');
SELECT pg_temp.expect_failure($$TRUNCATE organization_audit_events$$, 'P0001', 'append-only');
SELECT pg_temp.expect_failure($$UPDATE organization_audit_events SET action = 'forged'$$, 'P0001', 'append-only');
SELECT pg_temp.expect_failure($$DELETE FROM organization_audit_events$$, 'P0001', 'append-only');

DO $$ BEGIN
  ASSERT EXISTS (SELECT 1 FROM organization_audit_events
    WHERE entity_type = 'organization_memberships' AND action = 'update'
      AND actor_person_id = 'SYNTH-PERSON' AND request_id = 'synthetic-request'
      AND before ->> 'status' = 'active' AND after ->> 'status' = 'ended'), 'Missing lifecycle audit evidence';
END $$;

-- Give a browser-like role SELECT rights so RLS, rather than missing GRANTs,
-- is what prevents reads of the newly introduced organisation tables.
CREATE ROLE wl_synthetic_browser NOLOGIN;
GRANT SELECT ON organizations, organization_contracts, organization_modules,
  organization_memberships, organization_roles, organization_role_templates,
  organization_role_template_capabilities, organization_role_assignments,
  organization_grants, organization_audit_events TO wl_synthetic_browser;
SET LOCAL ROLE wl_synthetic_browser;
DO $$ DECLARE target_table TEXT; visible BOOLEAN; BEGIN
  FOREACH target_table IN ARRAY ARRAY['organizations', 'organization_contracts',
    'organization_modules', 'organization_memberships', 'organization_roles',
    'organization_role_templates', 'organization_role_template_capabilities',
    'organization_role_assignments', 'organization_grants', 'organization_audit_events'] LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', target_table) INTO visible;
    ASSERT NOT visible, 'Browser role can read ' || target_table;
  END LOOP;
END $$;
RESET ROLE;
SELECT 'Synthetic acceptance passed: preservation, legacy compatibility, scope/FK checks, history, audit, RLS, activation lock' AS result;
ROLLBACK;
