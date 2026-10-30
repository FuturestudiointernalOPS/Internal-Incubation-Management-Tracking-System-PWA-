-- Additive client branding configuration. This does not activate organisations
-- or change the existing client isolation preparation lock.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

INSERT INTO organization_role_template_capabilities
  (template_key, module, capability, access_level)
VALUES ('org_admin', 'organization_admin', 'branding.edit', 3)
ON CONFLICT (template_key, module, capability) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_branding (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE RESTRICT,
  display_name TEXT CHECK (display_name IS NULL OR length(btrim(display_name)) BETWEEN 1 AND 80),
  logo_url TEXT CHECK (
    logo_url IS NULL OR (
      length(logo_url) <= 2048 AND
      (logo_url ~ '^https://[^[:space:]<>"'']+$' OR (logo_url ~ '^/[^/]' AND logo_url !~ '[[:space:]<>"'']'))
    )
  ),
  primary_color TEXT CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by TEXT REFERENCES contacts(cid) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE organization_branding ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION wl_branding_identity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Organization branding is removed by clearing its values, not deleting history';
  ELSIF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Organization branding identity is immutable';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION wl_audit_branding_change() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  before_row JSONB;
  after_row JSONB := to_jsonb(NEW);
  changed_before JSONB;
  changed_after JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    before_row := to_jsonb(OLD);
    SELECT jsonb_object_agg(key, before_row -> key), jsonb_object_agg(key, value)
      INTO changed_before, changed_after
    FROM jsonb_each(after_row)
    WHERE value IS DISTINCT FROM before_row -> key;
    IF changed_after IS NULL THEN RETURN NEW; END IF;
  ELSE
    changed_after := after_row;
  END IF;
  INSERT INTO public.organization_audit_events
    (organization_id, actor_person_id, actor_role, action, entity_type, entity_id,
     before, after, metadata, request_id)
  VALUES (
    NEW.organization_id,
    NULLIF(current_setting('app.actor_person_id', TRUE), ''),
    'organization_admin',
    lower(TG_OP),
    'organization_branding',
    NEW.organization_id::text,
    changed_before,
    changed_after,
    jsonb_build_object('source', 'database-trigger'),
    NULLIF(current_setting('app.request_id', TRUE), '')
  );
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'organization_branding'::regclass
      AND tgname = 'wl_branding_identity'
  ) THEN
    CREATE TRIGGER wl_branding_identity
      BEFORE UPDATE OR DELETE ON organization_branding
      FOR EACH ROW EXECUTE FUNCTION wl_branding_identity();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'organization_branding'::regclass
      AND tgname = 'wl_branding_audit'
  ) THEN
    CREATE TRIGGER wl_branding_audit
      AFTER INSERT OR UPDATE ON organization_branding
      FOR EACH ROW EXECUTE FUNCTION wl_audit_branding_change();
  END IF;
END $$;
COMMIT;
