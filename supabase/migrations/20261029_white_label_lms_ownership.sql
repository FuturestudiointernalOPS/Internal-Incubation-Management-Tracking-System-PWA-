-- LMS tenant boundary. Requires the white-label foundation and LMS migrations.
-- Existing LMS records remain owned by Future Studio; existing internal
-- enrollment and assessment paths continue to use that platform scope.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE lms_courses
  ADD COLUMN IF NOT EXISTS owner_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;
UPDATE lms_courses
SET owner_organization_id = '00000000-0000-4000-8000-000000000001'
WHERE owner_organization_id IS NULL;
ALTER TABLE lms_courses
  ALTER COLUMN owner_organization_id SET DEFAULT '00000000-0000-4000-8000-000000000001',
  ALTER COLUMN owner_organization_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lms_courses_id_owner_org
  ON lms_courses (id, owner_organization_id);
CREATE INDEX IF NOT EXISTS lms_courses_owner_status
  ON lms_courses (owner_organization_id, status, updated_at DESC);

ALTER TABLE lms_enrollments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;
UPDATE lms_enrollments
SET organization_id = '00000000-0000-4000-8000-000000000001'
WHERE organization_id IS NULL;
ALTER TABLE lms_enrollments
  ALTER COLUMN organization_id SET DEFAULT '00000000-0000-4000-8000-000000000001',
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE lms_enrollments
  DROP CONSTRAINT IF EXISTS lms_enrollments_course_id_user_cid_key;
CREATE UNIQUE INDEX IF NOT EXISTS lms_enrollments_org_course_user
  ON lms_enrollments (organization_id, course_id, user_cid);
CREATE UNIQUE INDEX IF NOT EXISTS lms_enrollments_id_org
  ON lms_enrollments (id, organization_id);
CREATE INDEX IF NOT EXISTS lms_enrollments_org_user
  ON lms_enrollments (organization_id, user_cid, enrolled_at DESC);

ALTER TABLE lms_assessment_attempts
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;
UPDATE lms_assessment_attempts
SET organization_id = '00000000-0000-4000-8000-000000000001'
WHERE organization_id IS NULL;
ALTER TABLE lms_assessment_attempts
  ALTER COLUMN organization_id SET DEFAULT '00000000-0000-4000-8000-000000000001',
  ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE lms_assessment_attempts
  DROP CONSTRAINT IF EXISTS lms_assessment_attempts_user_cid_assessment_id_attempt_number_key;
ALTER TABLE lms_assessment_attempts
  DROP CONSTRAINT IF EXISTS lms_assessment_attempts_user_cid_assessment_id_attempt_numb_key;
CREATE UNIQUE INDEX IF NOT EXISTS lms_assessment_attempts_org_identity
  ON lms_assessment_attempts (organization_id, user_cid, assessment_id, attempt_number);
CREATE INDEX IF NOT EXISTS lms_assessment_attempts_org_assessment
  ON lms_assessment_attempts (organization_id, assessment_id);

ALTER TABLE lms_certificates
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;
UPDATE lms_certificates certificate
SET organization_id = enrollment.organization_id
FROM lms_enrollments enrollment
WHERE certificate.enrollment_id = enrollment.id
  AND certificate.organization_id IS NULL;
UPDATE lms_certificates
SET organization_id = '00000000-0000-4000-8000-000000000001'
WHERE organization_id IS NULL;
ALTER TABLE lms_certificates
  ALTER COLUMN organization_id SET DEFAULT '00000000-0000-4000-8000-000000000001',
  ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS lms_certificates_org_user
  ON lms_certificates (organization_id, user_cid, issued_at DESC);

CREATE TABLE IF NOT EXISTS organization_content_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('course', 'template', 'resource')),
  content_id TEXT NOT NULL,
  owner_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  licensee_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (owner_organization_id <> licensee_organization_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_content_licenses_one_active
  ON organization_content_licenses (content_type, content_id, licensee_organization_id)
  WHERE status = 'active';
ALTER TABLE organization_content_licenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE organization_grants
  DROP CONSTRAINT IF EXISTS organization_grants_module_check,
  DROP CONSTRAINT IF EXISTS organization_grants_capability_check;
ALTER TABLE organization_grants
  ADD CONSTRAINT organization_grants_module_check
    CHECK (module IN ('programs', 'lms')),
  ADD CONSTRAINT organization_grants_capability_check
    CHECK (
      (module = 'programs' AND capability = 'view')
      OR (module = 'lms' AND capability IN ('catalog.read', 'learning.read'))
    );

INSERT INTO organization_role_templates (key, label_key, scope_type) VALUES
  ('lms_learner', 'common.organizationPortal.roles.lmsLearner', 'organization'),
  ('lms_content_manager', 'common.organizationPortal.roles.lmsContentManager', 'organization')
ON CONFLICT (key) DO NOTHING;
INSERT INTO organization_role_template_capabilities (template_key, module, capability, access_level)
VALUES ('lms_learner', 'lms', 'learning.read', 1),
       ('lms_content_manager', 'lms', 'catalog.read', 1)
ON CONFLICT (template_key, module, capability) DO NOTHING;

CREATE OR REPLACE FUNCTION wl_validate_lms_course_license()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE course_owner UUID;
BEGIN
  IF NEW.content_type <> 'course' THEN RETURN NEW; END IF;
  SELECT owner_organization_id INTO course_owner
  FROM lms_courses WHERE id::text = NEW.content_id;
  IF NOT FOUND OR course_owner IS DISTINCT FROM NEW.owner_organization_id THEN
    RAISE EXCEPTION 'course license owner does not match the course owner';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wl_validate_lms_course_license ON organization_content_licenses;
CREATE TRIGGER wl_validate_lms_course_license
BEFORE INSERT OR UPDATE OF content_type, content_id, owner_organization_id
ON organization_content_licenses
FOR EACH ROW EXECUTE FUNCTION wl_validate_lms_course_license();

CREATE OR REPLACE FUNCTION wl_prevent_lms_course_owner_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_organization_id IS DISTINCT FROM OLD.owner_organization_id
    AND (
      EXISTS (SELECT 1 FROM lms_enrollments WHERE course_id = OLD.id)
      OR EXISTS (
        SELECT 1 FROM organization_content_licenses
        WHERE content_type = 'course' AND content_id = OLD.id::text
      )
    ) THEN
    RAISE EXCEPTION 'course ownership cannot change after enrollments or licenses exist';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wl_prevent_lms_course_owner_change ON lms_courses;
CREATE TRIGGER wl_prevent_lms_course_owner_change
BEFORE UPDATE OF owner_organization_id ON lms_courses
FOR EACH ROW EXECUTE FUNCTION wl_prevent_lms_course_owner_change();

CREATE OR REPLACE FUNCTION wl_validate_lms_enrollment_scope()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE course_owner UUID;
BEGIN
  SELECT owner_organization_id INTO course_owner
  FROM lms_courses WHERE id = NEW.course_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'course does not exist'; END IF;
  IF course_owner IS DISTINCT FROM NEW.organization_id
    AND NOT EXISTS (
      SELECT 1 FROM organization_content_licenses license
      WHERE license.content_type = 'course'
        AND license.content_id = NEW.course_id::text
        AND license.owner_organization_id = course_owner
        AND license.licensee_organization_id = NEW.organization_id
        AND license.status = 'active'
        AND (license.starts_at IS NULL OR license.starts_at <= NOW())
        AND (license.ends_at IS NULL OR license.ends_at > NOW())
    ) THEN
    RAISE EXCEPTION 'course is not owned or licensed by the enrollment organization';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wl_validate_lms_enrollment_scope ON lms_enrollments;
CREATE TRIGGER wl_validate_lms_enrollment_scope
BEFORE INSERT OR UPDATE OF course_id, organization_id
ON lms_enrollments
FOR EACH ROW EXECUTE FUNCTION wl_validate_lms_enrollment_scope();

CREATE OR REPLACE FUNCTION wl_validate_lms_attempt_scope()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lms_assessments assessment
    JOIN lms_enrollments enrollment
      ON enrollment.course_id = assessment.course_id
     AND enrollment.organization_id = NEW.organization_id
     AND enrollment.user_cid = NEW.user_cid
     AND enrollment.status <> 'suspended'
    WHERE assessment.id = NEW.assessment_id
  ) THEN
    RAISE EXCEPTION 'assessment attempt is outside the learner enrollment scope';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wl_validate_lms_attempt_scope ON lms_assessment_attempts;
CREATE TRIGGER wl_validate_lms_attempt_scope
BEFORE INSERT OR UPDATE OF organization_id, user_cid, assessment_id
ON lms_assessment_attempts
FOR EACH ROW EXECUTE FUNCTION wl_validate_lms_attempt_scope();

CREATE OR REPLACE FUNCTION wl_validate_lms_certificate_scope()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM lms_enrollments enrollment
    WHERE enrollment.id = NEW.enrollment_id
      AND enrollment.organization_id = NEW.organization_id
      AND enrollment.course_id = NEW.course_id
      AND enrollment.user_cid = NEW.user_cid
  ) THEN
    RAISE EXCEPTION 'certificate is outside the learner enrollment scope';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wl_validate_lms_certificate_scope ON lms_certificates;
CREATE TRIGGER wl_validate_lms_certificate_scope
BEFORE INSERT OR UPDATE OF enrollment_id, organization_id, course_id, user_cid
ON lms_certificates
FOR EACH ROW EXECUTE FUNCTION wl_validate_lms_certificate_scope();

COMMIT;
