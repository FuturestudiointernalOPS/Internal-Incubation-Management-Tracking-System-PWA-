-- Venture organisation ownership and assigned-member read capability.
-- Existing Ventures remain Future Studio records unless explicitly created
-- with a client owner by a future, approved provisioning flow.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE ventures
  ADD COLUMN IF NOT EXISTS owner_organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;
UPDATE ventures
SET owner_organization_id = '00000000-0000-4000-8000-000000000001'
WHERE owner_organization_id IS NULL;
ALTER TABLE ventures
  ALTER COLUMN owner_organization_id SET DEFAULT '00000000-0000-4000-8000-000000000001',
  ALTER COLUMN owner_organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS ventures_owner_status
  ON ventures (owner_organization_id, status, created_at DESC);

ALTER TABLE organization_grants
  DROP CONSTRAINT IF EXISTS organization_grants_module_check,
  DROP CONSTRAINT IF EXISTS organization_grants_capability_check;
ALTER TABLE organization_grants
  ADD CONSTRAINT organization_grants_module_check
    CHECK (module IN ('programs', 'lms', 'venture')),
  ADD CONSTRAINT organization_grants_capability_check
    CHECK (
      (module = 'programs' AND capability = 'view')
      OR (module = 'lms' AND capability IN ('catalog.read', 'learning.read'))
      OR (module = 'venture' AND capability = 'assigned.read')
    );

INSERT INTO organization_role_templates (key, label_key, scope_type)
VALUES ('venture_member', 'common.organizationPortal.roles.ventureMember', 'organization')
ON CONFLICT (key) DO NOTHING;
INSERT INTO organization_role_template_capabilities (template_key, module, capability, access_level)
VALUES ('venture_member', 'venture', 'assigned.read', 1)
ON CONFLICT (template_key, module, capability) DO NOTHING;

CREATE OR REPLACE FUNCTION wl_prevent_venture_owner_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.owner_organization_id IS DISTINCT FROM OLD.owner_organization_id THEN
    RAISE EXCEPTION 'venture ownership is immutable; use an approved transfer workflow';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS wl_prevent_venture_owner_change ON ventures;
CREATE TRIGGER wl_prevent_venture_owner_change
BEFORE UPDATE OF owner_organization_id ON ventures
FOR EACH ROW EXECUTE FUNCTION wl_prevent_venture_owner_change();

COMMIT;
