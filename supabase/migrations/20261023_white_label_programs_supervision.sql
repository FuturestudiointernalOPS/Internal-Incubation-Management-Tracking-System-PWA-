-- Additive, initially read-only supervision. Does NOT unlock client activation.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TABLE IF NOT EXISTS organization_supervision_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  staff_person_id TEXT NOT NULL REFERENCES contacts(cid) ON DELETE RESTRICT,
  scope TEXT NOT NULL CHECK (scope IN ('read', 'export', 'administer')),
  reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  granted_by TEXT NOT NULL REFERENCES contacts(cid) ON DELETE RESTRICT,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS wl_supervision_person_organization
  ON organization_supervision_grants (staff_person_id, organization_id, status, ends_at);
ALTER TABLE organization_supervision_grants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION wl_validate_supervision_grant() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = NEW.organization_id AND NOT is_platform) THEN
    RAISE EXCEPTION 'Supervision requires a client organization';
  END IF;
  IF TG_OP = 'INSERT' AND (NOT EXISTS (SELECT 1 FROM public.contacts WHERE cid = NEW.staff_person_id
    AND lower(btrim(role)) IN ('staff', 'super_admin') AND status IN ('active', 'approved') AND deleted = 0)
    OR NOT EXISTS (SELECT 1 FROM public.contacts WHERE cid = NEW.granted_by
    AND lower(btrim(role)) = 'super_admin' AND status IN ('active', 'approved') AND deleted = 0)) THEN
    RAISE EXCEPTION 'Supervision requires an internal actor and platform-owner grantor';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    (OLD.status = 'ended' AND NEW.status <> 'ended') OR
    (OLD.ended_at IS NOT NULL AND OLD.ended_at IS DISTINCT FROM NEW.ended_at)
  ) THEN
    RAISE EXCEPTION 'Ended supervision cannot be restored';
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.organization_supervision_grants'::regclass AND tgname = 'wl_supervision_validate') THEN
    CREATE TRIGGER wl_supervision_validate BEFORE INSERT OR UPDATE ON organization_supervision_grants
      FOR EACH ROW EXECUTE FUNCTION wl_validate_supervision_grant();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.organization_supervision_grants'::regclass AND tgname = 'wl_supervision_identity') THEN
    CREATE TRIGGER wl_supervision_identity BEFORE UPDATE ON organization_supervision_grants
      FOR EACH ROW EXECUTE FUNCTION wl_preserve_record_identity('id', 'organization_id', 'staff_person_id', 'scope', 'reason', 'starts_at', 'ends_at', 'granted_by', 'created_at');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.organization_supervision_grants'::regclass AND tgname = 'wl_supervision_no_delete') THEN
    CREATE TRIGGER wl_supervision_no_delete BEFORE DELETE ON organization_supervision_grants
      FOR EACH ROW EXECUTE FUNCTION wl_forbid_history_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.organization_supervision_grants'::regclass AND tgname = 'wl_supervision_no_truncate') THEN
    CREATE TRIGGER wl_supervision_no_truncate BEFORE TRUNCATE ON organization_supervision_grants
      FOR EACH STATEMENT EXECUTE FUNCTION wl_forbid_history_delete();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.organization_supervision_grants'::regclass AND tgname = 'wl_supervision_audit') THEN
    CREATE TRIGGER wl_supervision_audit AFTER INSERT OR UPDATE ON organization_supervision_grants
      FOR EACH ROW EXECUTE FUNCTION wl_audit_lifecycle_change();
  END IF;
END $$;
COMMIT;
