DO $$ BEGIN
  ASSERT (SELECT owner_organization_id = '00000000-0000-4000-8000-000000000001'
          FROM ventures WHERE venture_id = 'VNT-LEGACY'),
    'Legacy venture ownership must backfill to the platform';
  ASSERT EXISTS (SELECT 1 FROM organization_role_template_capabilities
                 WHERE template_key = 'venture_member'
                   AND module = 'venture' AND capability = 'assigned.read'),
    'Venture member read capability must be explicit';
  ASSERT (SELECT scope_type = 'organization' FROM organization_role_templates
          WHERE key = 'venture_member'),
    'Venture member access must be organization scoped';
END $$;

INSERT INTO ventures (id, venture_id, name, company_name, owner_organization_id)
VALUES ('44444444-4444-4444-8444-444444444444', 'VNT-CLIENT', 'Client Venture', 'Client Venture',
        'ffffffff-ffff-4fff-8fff-ffffffffffff'),
       ('55555555-5555-4555-8555-555555555555', 'VNT-OTHER', 'Other Venture', 'Other Venture',
        '99999999-9999-4999-8999-999999999999');
INSERT INTO venture_members (venture_id, contact_id, user_cid)
VALUES ('44444444-4444-4444-8444-444444444444', 'SYNTH-LMS', 'SYNTH-LMS');
INSERT INTO venture_staff_assignments (venture_id, staff_contact_id, status)
VALUES ('44444444-4444-4444-8444-444444444444', 'SYNTH-LMS', 'active'),
       ('55555555-5555-4555-8555-555555555555', 'SYNTH-LMS', 'active');

DO $$ BEGIN
  ASSERT (SELECT COUNT(*) = 1
          FROM ventures venture
          WHERE venture.owner_organization_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
            AND EXISTS (
              SELECT 1 FROM venture_members member
              WHERE member.venture_id::text IN (venture.id::text, venture.venture_id)
                AND (member.contact_id = 'SYNTH-LMS' OR member.user_cid = 'SYNTH-LMS')
                AND member.removed_at IS NULL AND member.suspended_at IS NULL
            )),
    'Member reads must include only assigned Ventures from the active organisation';
  ASSERT (SELECT COUNT(*) = 1
          FROM ventures venture
          WHERE venture.owner_organization_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
            AND EXISTS (
              SELECT 1 FROM venture_staff_assignments assignment
              WHERE assignment.venture_id::text IN (venture.id::text, venture.venture_id)
                AND assignment.staff_contact_id = 'SYNTH-LMS'
                AND assignment.status = 'active'
            )),
    'Staff reads must require an active assignment within the active organisation';
  BEGIN
    UPDATE ventures SET owner_organization_id = '99999999-9999-4999-8999-999999999999'
    WHERE venture_id = 'VNT-CLIENT';
    RAISE EXCEPTION 'expected venture ownership change to be rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'expected venture ownership change to be rejected' THEN RAISE; END IF;
  END;
END $$;

SELECT 'Venture ownership acceptance passed';
