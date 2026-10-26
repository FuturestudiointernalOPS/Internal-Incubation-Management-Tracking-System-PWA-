-- SQL from application repositories is substituted by the isolated test runner.
BEGIN;
SET LOCAL plpgsql.check_asserts = ON;
SET LOCAL app.actor_person_id = 'SYNTH-OWNER';
INSERT INTO contacts (cid, name, role) VALUES
  ('SYNTH-STAFF', 'Synthetic staff', 'staff'), ('SYNTH-OWNER', 'Synthetic owner', 'super_admin');
INSERT INTO organizations (id, code, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'synthetic-alpha', 'Synthetic Alpha'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'synthetic-beta', 'Synthetic Beta');

-- Deliberate fixture-only simulation of a FUTURE activated state. The actual
-- migrations keep activation blocked. No runtime code exposes this bypass.
SET LOCAL session_replication_role = replica;
UPDATE organizations SET status = 'active' WHERE NOT is_platform;
INSERT INTO v2_programs (id, name, organization_id, status, start_date, is_template) VALUES
  ('44444444-4444-4444-8444-444444444444', 'Client A private', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Planned', CURRENT_DATE, 1),
  ('55555555-5555-4555-8555-555555555555', 'Client B private', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Planned', CURRENT_DATE, 1);
SET LOCAL session_replication_role = origin;
INSERT INTO organization_contracts (organization_id, plan_key, status, signed_at) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'synthetic', 'active', NOW()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'synthetic', 'active', NOW());
INSERT INTO organization_modules (organization_id, module_key, status) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'programs', 'enabled'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'programs', 'enabled');
INSERT INTO user_sessions (token, token_hash, user_cid, role, expires_at) VALUES
  ('synthetic-staff-token', 'synthetic-hash', 'SYNTH-STAFF', 'staff', '2099-01-01');

DO $$ BEGIN
  ASSERT (SELECT count(*) = 1 FROM ({{internal.list}}) q), 'Internal directory leaked a client';
  ASSERT (SELECT count(*) = 0 FROM ({{internal.detail}}) q), 'Internal detail leaked a client';
  ASSERT (SELECT count(*) = 0 FROM ({{internal.templates}}) q), 'Internal templates leaked a client';
  ASSERT (SELECT count(*) = 1 FROM ({{internal.managed}}) q), 'Internal management list leaked a client';
  ASSERT (SELECT count(*) = 0 FROM ({{supervision.mandate}}) q), 'Supervision without mandate';
END $$;
UPDATE v2_programs SET status = 'Planned', start_date = CURRENT_DATE
  WHERE id = '11111111-1111-4111-8111-111111111111';
{{internal.activate}};
{{internal.update}};
DO $$ BEGIN
  ASSERT (SELECT status = 'Active' FROM v2_programs WHERE id = '11111111-1111-4111-8111-111111111111'), 'Platform activation broken';
  ASSERT (SELECT status = 'Planned' AND name = 'Client A private' FROM v2_programs WHERE id = '44444444-4444-4444-8444-444444444444'), 'Internal write touched client';
END $$;

INSERT INTO organization_supervision_grants (id, organization_id, staff_person_id, scope, reason, ends_at, granted_by) VALUES
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'SYNTH-STAFF', 'read',
   'Synthetic support ticket', clock_timestamp() + interval '1 hour', 'SYNTH-OWNER');
DO $$ DECLARE recorded INTEGER; BEGIN
  ASSERT (SELECT count(*) = 1 FROM ({{supervision.mandate}}) q), 'Valid mandate not found';
  ASSERT (SELECT count(*) = 0 FROM ({{supervision.otherOrganization}}) q), 'Mandate crossed organisation';
  ASSERT (SELECT count(*) = 1 FROM ({{supervision.list}}) q), 'Supervised list crossed organisation';
  ASSERT (SELECT count(*) = 1 FROM ({{supervision.detail}}) q), 'Supervised detail missing';
  ASSERT (SELECT count(*) = 0 FROM ({{supervision.foreignDetail}}) q), 'Supervised foreign detail leaked';
  WITH recorded AS ({{supervision.audit}}) SELECT count(*) INTO recorded FROM recorded;
  ASSERT recorded = 1, 'Supervision read was not audited';
  ASSERT EXISTS (SELECT 1 FROM organization_audit_events WHERE action = 'supervision.programs.list'
    AND actor_person_id = 'SYNTH-STAFF' AND request_id = 'synthetic-supervision-request'
    AND metadata ->> 'mandate_id' = 'ffffffff-ffff-4fff-8fff-ffffffffffff'), 'Supervision audit attribution missing';
END $$;

-- Fresh identity/module/contract checks cannot be bypassed by a cached session.
UPDATE organization_modules SET status = 'disabled' WHERE organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$ BEGIN ASSERT (SELECT count(*) = 0 FROM ({{supervision.mandate}}) q), 'Disabled module retained supervision'; END $$;
UPDATE organization_modules SET status = 'enabled' WHERE organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE organization_contracts SET status = 'suspended' WHERE organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$ BEGIN ASSERT (SELECT count(*) = 0 FROM ({{supervision.mandate}}) q), 'Suspended contract retained supervision'; END $$;
UPDATE organization_contracts SET status = 'active' WHERE organization_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
UPDATE user_sessions SET expires_at = clock_timestamp() - interval '1 second' WHERE user_cid = 'SYNTH-STAFF';
DO $$ BEGIN ASSERT (SELECT count(*) = 0 FROM ({{supervision.mandate}}) q), 'Expired session retained supervision'; END $$;
UPDATE user_sessions SET expires_at = '2099-01-01' WHERE user_cid = 'SYNTH-STAFF';
UPDATE organizations SET status = 'suspended' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$ BEGIN ASSERT (SELECT count(*) = 0 FROM ({{supervision.mandate}}) q), 'Suspended organisation retained supervision'; END $$;
-- Restore the future active state only inside this rolled-back fixture.
SET LOCAL session_replication_role = replica;
UPDATE organizations SET status = 'active' WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
SET LOCAL session_replication_role = origin;
UPDATE contacts SET role = 'member' WHERE cid = 'SYNTH-STAFF';
DO $$ BEGIN ASSERT (SELECT count(*) = 0 FROM ({{supervision.mandate}}) q), 'Former staff retained supervision'; END $$;
UPDATE organization_supervision_grants SET status = 'ended', ended_at = NOW();
UPDATE contacts SET role = 'staff' WHERE cid = 'SYNTH-STAFF';
DO $$ BEGIN ASSERT (SELECT count(*) = 0 FROM ({{supervision.mandate}}) q), 'Ended mandate retained supervision'; END $$;

INSERT INTO organization_supervision_grants (organization_id, staff_person_id, scope, reason, ends_at, granted_by) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'SYNTH-STAFF', 'export', 'Synthetic export-only mandate', clock_timestamp() + interval '1 hour', 'SYNTH-OWNER');
DO $$ BEGIN ASSERT (SELECT count(*) = 0 FROM ({{supervision.mandate}}) q), 'Export mandate implicitly authorised read'; END $$;

INSERT INTO organization_supervision_grants (id, organization_id, staff_person_id, scope, reason, ends_at, granted_by) VALUES
  ('ffffffff-ffff-4fff-8fff-fffffffffff2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'SYNTH-STAFF', 'read',
   'Synthetic deadline check', clock_timestamp() + interval '2 seconds', 'SYNTH-OWNER');
DO $$ BEGIN ASSERT (SELECT count(*) = 1 FROM ({{supervision.mandate}}) q), 'Short mandate not found'; END $$;
SELECT pg_sleep(2.1);
DO $$ DECLARE recorded INTEGER; BEGIN
  WITH recorded AS ({{supervision.auditDeadline}}) SELECT count(*) INTO recorded FROM recorded;
  ASSERT recorded = 0, 'Expired mandate was audited as allowed';
END $$;

-- WORKSPACE_ACCEPTANCE

CREATE ROLE wl_supervision_browser NOLOGIN;
GRANT SELECT ON organization_supervision_grants TO wl_supervision_browser;
SET LOCAL ROLE wl_supervision_browser;
DO $$ BEGIN ASSERT NOT EXISTS (SELECT 1 FROM organization_supervision_grants), 'Browser read supervision mandates'; END $$;
RESET ROLE;
SELECT 'Supervision acceptance passed: real repository SQL, platform boundary, fresh mandates, audit and expiry' AS result;
ROLLBACK;
