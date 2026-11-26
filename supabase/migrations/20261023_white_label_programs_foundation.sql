-- White-Label / Programmes: additive PREPARATION ONLY.
-- Apply explicitly on an isolated database first. Never called by initDb.
-- No existing row is updated, deleted, renamed or converted by this migration.
-- Existing NULL owners represent the platform until an approved backfill.
-- Client activation AND client programme writes remain blocked in this increment:
-- legacy internal readers are not yet exhaustively isolated.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  kind TEXT NOT NULL DEFAULT 'company'
    CHECK (kind IN ('company','university','incubator','ngo','public_body','other')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','suspended','archived','closed')),
  is_platform BOOLEAN NOT NULL DEFAULT FALSE,
  default_locale TEXT NOT NULL DEFAULT 'fr',
  timezone TEXT NOT NULL DEFAULT 'Africa/Porto-Novo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_one_platform
  ON organizations (is_platform) WHERE is_platform;

-- Fixed platform ID is also the default for legacy programme INSERTs.
INSERT INTO organizations (id, code, name, status, is_platform)
VALUES ('00000000-0000-4000-8000-000000000001', 'future-studio', 'Future Studio', 'active', TRUE)
ON CONFLICT (id) DO NOTHING;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = '00000000-0000-4000-8000-000000000001'
      AND is_platform AND status = 'active' AND code = 'future-studio'
  ) THEN
    RAISE EXCEPTION 'White-Label platform identity conflicts with existing configuration';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS organization_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','suspended','ended')),
  starts_at DATE,
  ends_at DATE,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_contracts_one_active
  ON organization_contracts (organization_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  module_key TEXT NOT NULL CHECK (module_key IN ('programs','lms','venture')),
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('enabled','disabled','trial','suspended')),
  starts_at DATE,
  ends_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, module_key),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at)
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  person_id TEXT NOT NULL REFERENCES contacts(cid) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','suspended','ended')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  CHECK (started_at IS NULL OR expires_at IS NULL OR started_at < expires_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_one_active
  ON organization_memberships (organization_id, person_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS organization_memberships_person
  ON organization_memberships (person_id, status);

CREATE TABLE IF NOT EXISTS organization_role_templates (
  key TEXT PRIMARY KEY,
  label_key TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization','program'))
);
CREATE TABLE IF NOT EXISTS organization_role_template_capabilities (
  template_key TEXT NOT NULL REFERENCES organization_role_templates(key) ON DELETE RESTRICT,
  module TEXT NOT NULL,
  capability TEXT NOT NULL,
  access_level INTEGER NOT NULL DEFAULT 1 CHECK (access_level > 0),
  PRIMARY KEY (template_key, module, capability)
);
-- Deliberately read-only ceilings. No delegation or global internal role grant.
INSERT INTO organization_role_templates (key, label_key, scope_type) VALUES
  ('org_admin', 'organization.roles.orgAdmin', 'organization'),
  ('program_manager', 'organization.roles.programManager', 'program')
ON CONFLICT (key) DO NOTHING;
INSERT INTO organization_role_template_capabilities (template_key, module, capability, access_level)
VALUES ('org_admin', 'programs', 'view', 1), ('program_manager', 'programs', 'view', 1)
ON CONFLICT (template_key, module, capability) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  template_key TEXT NOT NULL REFERENCES organization_role_templates(key) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  UNIQUE (organization_id, template_key)
);
CREATE TABLE IF NOT EXISTS organization_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  membership_id UUID NOT NULL,
  role_id UUID NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization','program')),
  scope_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','ended')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (membership_id, organization_id)
    REFERENCES organization_memberships(id, organization_id) ON DELETE RESTRICT,
  FOREIGN KEY (role_id, organization_id)
    REFERENCES organization_roles(id, organization_id) ON DELETE RESTRICT,
  CHECK ((scope_type = 'organization' AND scope_id IS NULL)
    OR (scope_type = 'program' AND scope_id IS NOT NULL)),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS organization_role_assignments_one_active
  ON organization_role_assignments (membership_id, role_id, scope_type, COALESCE(scope_id, ''))
  WHERE status = 'active';

-- Group grants and non-Programmes scopes are not part of this first increment.
CREATE TABLE IF NOT EXISTS organization_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('membership','role_assignment')),
  subject_id TEXT NOT NULL,
  module TEXT NOT NULL CHECK (module = 'programs'),
  capability TEXT NOT NULL CHECK (capability = 'view'),
  access_level INTEGER NOT NULL DEFAULT 1 CHECK (access_level > 0),
  effect TEXT NOT NULL CHECK (effect IN ('allow','deny')),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('organization','program')),
  scope_id TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((scope_type = 'organization' AND scope_id IS NULL)
    OR (scope_type = 'program' AND scope_id IS NOT NULL)),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);
CREATE INDEX IF NOT EXISTS organization_grants_subject
  ON organization_grants (organization_id, subject_type, subject_id);

-- New public-schema tables must not become accessible through Supabase's
-- default browser roles. No client RLS policies are installed at this stage.
-- The existing trusted server DB role must be validated on the isolated target;
-- an unprivileged connection gets no rows rather than an unscoped fallback.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_role_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_role_template_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_grants ENABLE ROW LEVEL SECURITY;

-- Add nullable columns only: legacy rows and existing uniqueness stay intact.
ALTER TABLE v2_programs ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE v2_programs ALTER COLUMN organization_id
  SET DEFAULT '00000000-0000-4000-8000-000000000001'::UUID;
CREATE INDEX IF NOT EXISTS wl_programs_organization_created
  ON v2_programs (organization_id, created_at DESC, id DESC);
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS active_organization_id UUID
  REFERENCES organizations(id) ON DELETE RESTRICT;

-- An additive safety lock, NOT a completed isolation system. A later reviewed
-- migration may replace this function after internal isolation/supervision tests.
CREATE OR REPLACE FUNCTION wl_programs_preparation_guard() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.is_platform <> OLD.is_platform) THEN
      RAISE EXCEPTION 'Organization identity is immutable';
    END IF;
    IF NOT NEW.is_platform AND NEW.status = 'active' THEN
      RAISE EXCEPTION 'Client activation blocked: White-Label isolation not yet approved';
    END IF;
  ELSE
    IF NEW.organization_id IS NOT NULL
      AND NEW.organization_id <> '00000000-0000-4000-8000-000000000001'::UUID THEN
      RAISE EXCEPTION 'Client programme writes blocked: White-Label isolation not yet approved';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'organizations'::regclass AND tgname = 'wl_organizations_preparation') THEN
    CREATE TRIGGER wl_organizations_preparation BEFORE INSERT OR UPDATE ON organizations
      FOR EACH ROW EXECUTE FUNCTION wl_programs_preparation_guard();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'v2_programs'::regclass AND tgname = 'wl_programs_preparation') THEN
    CREATE TRIGGER wl_programs_preparation BEFORE INSERT OR UPDATE OF organization_id ON v2_programs
      FOR EACH ROW EXECUTE FUNCTION wl_programs_preparation_guard();
  END IF;
END $$;
COMMIT;
