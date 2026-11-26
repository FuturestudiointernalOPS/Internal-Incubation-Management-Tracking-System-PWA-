-- Same rolled-back synthetic transaction; no real client activation.
INSERT INTO organization_memberships (id,organization_id,person_id,status,started_at) VALUES
 ('66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','SYNTH-PERSON','active',NOW());
INSERT INTO organization_roles (id,organization_id,template_key,label) VALUES
 ('77777777-7777-4777-8777-777777777777','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','org_admin','Synthetic client admin');
INSERT INTO organization_role_assignments (organization_id,membership_id,role_id,scope_type,status) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777','organization','active');
DO $$ DECLARE changed INTEGER; BEGIN
 ASSERT (SELECT count(*)=0 FROM ({{guard.client}}) q), 'Internal write perimeter admits client programme';
 ASSERT (SELECT count(*)=1 FROM ({{guard.platform}}) q), 'Internal write perimeter lost legacy programme';
 ASSERT (SELECT count(*)=1 FROM ({{context.session}}) q), 'Current client session missing';
 ASSERT (SELECT count(*)=1 FROM ({{context.memberships}}) q), 'Own active membership missing';
 ASSERT (SELECT membership_id IS NOT NULL AND contract_active AND module_enabled AND jsonb_array_length(assignments)=1 AND actor_role='member' FROM ({{context.access}}) q), 'Candidate client context prerequisites missing';
 WITH selected AS ({{context.switch}}) SELECT count(*) INTO changed FROM selected;
 ASSERT changed=1, 'Session context was not changed';
 ASSERT (SELECT organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid FROM ({{context.current}}) q), 'Fresh session context was not used';
 WITH selected AS ({{context.staleSwitch}}) SELECT count(*) INTO changed FROM selected;
 ASSERT changed=0, 'Stale tab overwrote a later context';
END $$;
{{context.audit}};
DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM organization_audit_events WHERE request_id='synthetic-context-change' AND actor_person_id='SYNTH-PERSON' AND action='organization.context.changed'), 'Context audit missing'; END $$;
UPDATE organization_memberships SET status='ended',ended_at=NOW() WHERE id='66666666-6666-4666-8666-666666666666';
DO $$ BEGIN ASSERT (SELECT membership_id IS NULL FROM ({{context.current}}) q), 'Revoked membership survived fresh context resolution'; END $$;
UPDATE organizations SET status='suspended' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
DO $$ BEGIN ASSERT (SELECT organization_status='suspended' FROM ({{context.current}}) q), 'Suspension survived fresh context resolution'; END $$;
SELECT 'Context acceptance passed' AS result;

DO $$ BEGIN
 ASSERT (SELECT count(*)=1 FROM ({{metrics.countSessionsByProgram}}) q), 'Aggregate countSessionsByProgram included client programmes or lost platform';
 ASSERT (SELECT count(*)=1 FROM ({{metrics.countActiveParticipantsByProgram}}) q), 'Aggregate countActiveParticipantsByProgram included client programmes or lost platform';
 ASSERT (SELECT count(*)=1 FROM ({{metrics.countDocumentRequirementsByProgram}}) q), 'Aggregate countDocumentRequirementsByProgram included client programmes or lost platform';
 ASSERT (SELECT count(*)=1 FROM ({{metrics.countReportWeeksByProgram}}) q), 'Aggregate countReportWeeksByProgram included client programmes or lost platform';
 ASSERT (SELECT count(*)=1 FROM ({{metrics.getAssignedFamiliesByProgram}}) q), 'Aggregate getAssignedFamiliesByProgram included client programmes or lost platform';
 ASSERT (SELECT count(*)=1 FROM ({{metrics.countSubmissionsByProgram}}) q), 'Aggregate countSubmissionsByProgram included client programmes or lost platform';
END $$;
