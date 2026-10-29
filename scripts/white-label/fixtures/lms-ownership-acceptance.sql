INSERT INTO organizations (id, code, name)
VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'synthetic-lms-client', 'Synthetic LMS Client'),
       ('99999999-9999-4999-8999-999999999999', 'synthetic-lms-other', 'Synthetic LMS Other');
INSERT INTO contacts (cid, name, email)
VALUES ('SYNTH-LMS', 'Synthetic LMS Member', 'lms-member@example.invalid');
DO $$ BEGIN
  ASSERT (SELECT owner_organization_id = '00000000-0000-4000-8000-000000000001'
          FROM lms_courses WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    'Legacy course ownership must backfill to the platform';
  ASSERT (SELECT organization_id = '00000000-0000-4000-8000-000000000001'
          FROM lms_enrollments WHERE id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
    'Legacy enrollment scope must backfill to the platform';
END $$;

INSERT INTO lms_assessments (id, course_id, title)
VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Synthetic Assessment');
INSERT INTO organization_content_licenses
  (content_type, content_id, owner_organization_id, licensee_organization_id)
VALUES ('course', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        '00000000-0000-4000-8000-000000000001',
        'ffffffff-ffff-4fff-8fff-ffffffffffff');
INSERT INTO organization_memberships (id, organization_id, person_id, status)
VALUES ('12121212-1212-4121-8121-121212121212',
        'ffffffff-ffff-4fff-8fff-ffffffffffff', 'SYNTH-LMS', 'active');
INSERT INTO organization_grants
  (organization_id, subject_type, subject_id, module, capability, effect, scope_type)
VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'membership', '12121212-1212-4121-8121-121212121212',
        'lms', 'learning.read', 'deny', 'organization');

INSERT INTO lms_enrollments (course_id, user_cid, organization_id, source)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'SYNTH-PERSON',
        'ffffffff-ffff-4fff-8fff-ffffffffffff', 'admin');
INSERT INTO lms_assessment_attempts
  (user_cid, assessment_id, organization_id, attempt_number)
VALUES ('SYNTH-PERSON', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '00000000-0000-4000-8000-000000000001', 1),
       ('SYNTH-PERSON', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'ffffffff-ffff-4fff-8fff-ffffffffffff', 1);
INSERT INTO lms_certificates
  (certificate_number, verification_token, enrollment_id, course_id, user_cid, learner_name, course_title)
VALUES ('CERT-TEST-PLATFORM', 'synthetic-platform-token',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'SYNTH-PERSON',
        'Synthetic Person', 'Synthetic Course');
INSERT INTO lms_certificates
  (certificate_number, verification_token, enrollment_id, course_id, user_cid,
   learner_name, course_title, organization_id)
SELECT 'CERT-TEST-CLIENT', 'synthetic-client-token', id, course_id, user_cid,
       'Synthetic Person', 'Synthetic Course', organization_id
FROM lms_enrollments
WHERE user_cid = 'SYNTH-PERSON'
  AND organization_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

DO $$ BEGIN
  ASSERT (SELECT COUNT(*) = 2 FROM lms_enrollments
          WHERE course_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
            AND user_cid = 'SYNTH-PERSON'),
    'Same learner may enroll in the same course in separate organisations';
  ASSERT (SELECT COUNT(DISTINCT organization_id) = 2 FROM lms_assessment_attempts
          WHERE user_cid = 'SYNTH-PERSON'
            AND assessment_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
    'Assessment attempts must be separate by organisation';
  ASSERT (SELECT organization_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
          FROM lms_certificates WHERE certificate_number = 'CERT-TEST-CLIENT'),
    'Certificate scope must follow its enrollment';
  ASSERT EXISTS (SELECT 1 FROM organization_role_template_capabilities
                 WHERE template_key = 'lms_learner'
                   AND module = 'lms' AND capability = 'learning.read'),
    'LMS learner capabilities must be explicit';

  BEGIN
    INSERT INTO lms_enrollments (course_id, user_cid, organization_id)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'SYNTH-PERSON',
            '99999999-9999-4999-8999-999999999999');
    RAISE EXCEPTION 'expected unlicensed enrollment to be rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'expected unlicensed enrollment to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    INSERT INTO lms_certificates
      (certificate_number, verification_token, enrollment_id, course_id, user_cid,
       learner_name, course_title)
    SELECT 'CERT-TEST-CROSS', 'synthetic-cross-token', id, course_id, user_cid,
         'Synthetic Person', 'Synthetic Course'
    FROM lms_enrollments
    WHERE user_cid = 'SYNTH-PERSON'
      AND organization_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    RAISE EXCEPTION 'expected cross-organisation certificate to be rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'expected cross-organisation certificate to be rejected' THEN RAISE; END IF;
  END;

  BEGIN
    UPDATE lms_courses
    SET owner_organization_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'expected ownership change to be rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'expected ownership change to be rejected' THEN RAISE; END IF;
  END;
END $$;

SELECT 'LMS ownership acceptance passed';
