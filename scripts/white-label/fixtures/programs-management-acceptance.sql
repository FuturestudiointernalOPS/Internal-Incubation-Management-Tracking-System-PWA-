-- Dedicated synthetic database only; all fictitious activated records rollback.
BEGIN;
SET LOCAL plpgsql.check_asserts=ON;
SET LOCAL app.actor_person_id='SYNTH-PERSON';
SET LOCAL app.request_id='synthetic-management';
CREATE FUNCTION pg_temp.management_reject(statement TEXT, expected_state TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$ BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>expected_state THEN RAISE EXCEPTION 'Unexpected management failure: % %',SQLSTATE,SQLERRM; END IF;
  RETURN;
 END;
 RAISE EXCEPTION 'Expected management statement rejection';
END $$;
INSERT INTO organizations(id,code,name) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','management-alpha','Synthetic Alpha'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','management-beta','Synthetic Beta');
SELECT pg_temp.management_reject($q$UPDATE organizations SET status='active' WHERE code='management-alpha'$q$,'P0001');
SELECT pg_temp.management_reject($q${{management.create}}$q$,'P0001');
-- Fixture-only state simulation. This bypass is never provided by the app.
SET LOCAL session_replication_role=replica;
UPDATE organizations SET status='active' WHERE NOT is_platform;
INSERT INTO v2_programs(id,organization_id,name,status) VALUES
 ('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A programme','active'),
 ('55555555-5555-4555-8555-555555555555','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B programme','active');
{{management.create}};
SET LOCAL session_replication_role=origin;
INSERT INTO contacts(cid,name) VALUES ('SYNTH-STUDENT','Synthetic Student');
INSERT INTO organization_memberships(id,organization_id,person_id,status) VALUES
 ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SYNTH-PERSON','active'),
 ('88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SYNTH-STUDENT','active'),
 ('77777777-7777-4777-8777-777777777777','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','SYNTH-PERSON','active');
INSERT INTO organization_roles(id,organization_id,template_key,label) VALUES
 ('11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','organization_program_editor','Synthetic editor');
INSERT INTO organization_role_assignments(organization_id,membership_id,role_id,scope_type) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','organization');
INSERT INTO organization_contracts(organization_id,plan_key,status,signed_at) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','synthetic','active',NOW());
INSERT INTO organization_modules(organization_id,module_key,status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','programs','enabled');
UPDATE user_sessions SET active_organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' WHERE token='synthetic-token';
INSERT INTO organization_program_cohorts(id,organization_id,program_id,name,year,status) VALUES
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','Cohort 2027',2027,'active');
INSERT INTO organization_program_enrollments(id,organization_id,program_id,cohort_id,membership_id) VALUES
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','66666666-6666-4666-8666-666666666666');
DO $$ BEGIN
 ASSERT (SELECT (assignments->0->'capabilities'->>'create')::integer=1 FROM ({{management.access}}) a),'Management capability not read from template';
 ASSERT (SELECT count(*)=1 FROM ({{management.program}}) p),'Own programme missing';
 ASSERT (SELECT count(*)=0 FROM ({{management.foreignProgram}}) p),'Foreign programme exposed';
 ASSERT (SELECT count(*)=2 FROM ({{management.members}}) m),'Member search crossed organisation';
 ASSERT (SELECT count(*)=1 FROM ({{management.cohorts}}) c),'Cohort query invalid';
 ASSERT (SELECT count(*)=1 FROM ({{management.enrollments}}) e),'Enrollment query invalid';
END $$;
{{management.sessionCreate.0}};
{{management.sessionCreate.1}};
DO $$ BEGIN
 ASSERT (SELECT count(*)=1 FROM ({{management.sessions}}) s),'Own scheduled session missing';
 ASSERT (SELECT count(*)=0 FROM ({{management.foreignSessions}}) s),'Session crosses organisation';
END $$;
{{management.update}};
{{management.revision}};
{{management.revision}};
{{management.cohortCreate}};
{{management.enroll}};
{{management.end}};
{{management.audit}};
DO $$ BEGIN
 ASSERT (SELECT revision=2 FROM organization_program_revisions WHERE id='44444444-4444-4444-8444-444444444444'),'Revision update lost';
 ASSERT (SELECT count(*)=2 FROM organization_program_cohorts),'New year overwrote previous cohort';
 ASSERT (SELECT status='completed' AND revision=2 AND ended_at IS NOT NULL FROM organization_program_enrollments WHERE id='33333333-3333-4333-8333-333333333333'),'Enrollment history lost';
 ASSERT EXISTS(SELECT 1 FROM organization_audit_events WHERE entity_type='organization_program_enrollments' AND actor_person_id='SYNTH-PERSON' AND request_id='synthetic-management'),'Enrollment audit attribution missing';
 ASSERT EXISTS(SELECT 1 FROM organization_audit_events WHERE action='program.update' AND actor_person_id='SYNTH-PERSON'),'Programme audit missing';
END $$;
SELECT pg_temp.management_reject($q$INSERT INTO organization_program_enrollments(organization_id,program_id,cohort_id,membership_id) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','77777777-7777-4777-8777-777777777777')$q$,'23503');
SELECT pg_temp.management_reject($q$UPDATE organization_program_cohorts SET year=2028,revision=revision+1 WHERE year=2027$q$,'P0001');
SELECT pg_temp.management_reject($q$UPDATE organization_program_enrollments SET status='active',ended_at=NULL,revision=revision+1 WHERE id='33333333-3333-4333-8333-333333333333'$q$,'P0001');
SELECT pg_temp.management_reject($q$DELETE FROM organization_program_cohorts$q$,'P0001');
SELECT pg_temp.management_reject($q$TRUNCATE organization_program_enrollments$q$,'P0001');
SELECT pg_temp.management_reject($q$UPDATE organization_program_cohorts SET status='completed',revision=revision+1 WHERE year=2027$q$,'P0001');
SELECT pg_temp.management_reject($q$UPDATE v2_programs SET status='completed' WHERE id='44444444-4444-4444-8444-444444444444'$q$,'P0001');
UPDATE organization_program_enrollments SET status='withdrawn',ended_at=NOW(),revision=revision+1 WHERE status='active';
SELECT pg_temp.management_reject($q$UPDATE organization_program_cohorts SET status='completed',revision=revision+1 WHERE year=2027$q$,'P0001');
{{management.sessionUpdate.0}};
{{management.sessionUpdate.1}};
SELECT pg_temp.management_reject($q$UPDATE v2_sessions SET title='Lost history' WHERE id='aaaaaaaa-1111-4111-8111-111111111111'$q$,'P0001');
SELECT pg_temp.management_reject($q$UPDATE organization_program_session_links SET duration_minutes=120,revision=revision+1 WHERE id='aaaaaaaa-1111-4111-8111-111111111111'$q$,'P0001');
UPDATE organization_program_cohorts SET status='completed',revision=revision+1;
SELECT pg_temp.management_reject($q${{management.enroll}}$q$,'P0001');
UPDATE v2_programs SET status='completed' WHERE id='44444444-4444-4444-8444-444444444444';
SELECT pg_temp.management_reject($q$UPDATE v2_programs SET name='Rewritten history' WHERE id='44444444-4444-4444-8444-444444444444'$q$,'P0001');
SELECT pg_temp.management_reject($q$INSERT INTO organization_program_cohorts(organization_id,program_id,name,year) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444','Disallowed new cohort',2029)$q$,'P0001');
CREATE ROLE wl_management_browser NOLOGIN;
GRANT SELECT ON organization_program_cohorts,organization_program_enrollments,organization_program_revisions,organization_program_session_links TO wl_management_browser;
SET LOCAL ROLE wl_management_browser;
DO $$ BEGIN
 ASSERT NOT EXISTS(SELECT 1 FROM organization_program_cohorts),'Browser sees cohorts';
 ASSERT NOT EXISTS(SELECT 1 FROM organization_program_enrollments),'Browser sees enrollments';
 ASSERT NOT EXISTS(SELECT 1 FROM organization_program_revisions),'Browser sees revisions';
 ASSERT NOT EXISTS(SELECT 1 FROM organization_program_session_links),'Browser sees session links';
END $$;
RESET ROLE;
SELECT 'Management acceptance passed' AS result;
ROLLBACK;
