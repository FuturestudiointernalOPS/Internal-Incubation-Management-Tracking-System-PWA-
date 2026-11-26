-- Additive continuation of 20261023_white_label_programs_foundation.sql.
-- No business-row rewrite, deletion, client activation or preparation unlock.
-- Apply on an isolated database first. Not registered in runtime maintenance.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS organization_audit_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_person_id TEXT,
  actor_role TEXT NOT NULL DEFAULT CURRENT_USER,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before JSONB,
  after JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS organization_audit_events_org_created
  ON organization_audit_events (organization_id, created_at DESC, id DESC);
ALTER TABLE organization_audit_events ENABLE ROW LEVEL SECURITY;

-- Typed generated references keep polymorphic scopes safe even when concurrent
-- transactions create an assignment and remove its parent. Checks alone are
-- not a replacement for these FKs. Existing programme PK uniqueness is kept.
CREATE UNIQUE INDEX IF NOT EXISTS wl_programs_id_organization
  ON v2_programs (id, organization_id);
ALTER TABLE organization_role_assignments ADD COLUMN IF NOT EXISTS program_scope_id UUID
  GENERATED ALWAYS AS (CASE WHEN scope_type = 'program' THEN scope_id::UUID END) STORED;
ALTER TABLE organization_grants ADD COLUMN IF NOT EXISTS program_scope_id UUID
  GENERATED ALWAYS AS (CASE WHEN scope_type = 'program' THEN scope_id::UUID END) STORED;
ALTER TABLE organization_grants ADD COLUMN IF NOT EXISTS membership_subject_id UUID
  GENERATED ALWAYS AS (CASE WHEN subject_type = 'membership' THEN subject_id::UUID END) STORED;
ALTER TABLE organization_grants ADD COLUMN IF NOT EXISTS assignment_subject_id UUID
  GENERATED ALWAYS AS (CASE WHEN subject_type = 'role_assignment' THEN subject_id::UUID END) STORED;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.organization_role_assignments'::regclass AND conname = 'wl_assignment_program_org_fk') THEN
    ALTER TABLE organization_role_assignments ADD CONSTRAINT wl_assignment_program_org_fk
      FOREIGN KEY (program_scope_id, organization_id) REFERENCES v2_programs(id, organization_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.organization_grants'::regclass AND conname = 'wl_grant_program_org_fk') THEN
    ALTER TABLE organization_grants ADD CONSTRAINT wl_grant_program_org_fk
      FOREIGN KEY (program_scope_id, organization_id) REFERENCES v2_programs(id, organization_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.organization_grants'::regclass AND conname = 'wl_grant_membership_org_fk') THEN
    ALTER TABLE organization_grants ADD CONSTRAINT wl_grant_membership_org_fk
      FOREIGN KEY (membership_subject_id, organization_id) REFERENCES organization_memberships(id, organization_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.organization_grants'::regclass AND conname = 'wl_grant_assignment_org_fk') THEN
    ALTER TABLE organization_grants ADD CONSTRAINT wl_grant_assignment_org_fk
      FOREIGN KEY (assignment_subject_id, organization_id) REFERENCES organization_role_assignments(id, organization_id)
      ON UPDATE RESTRICT ON DELETE RESTRICT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION wl_forbid_history_delete() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'White-Label history cannot be deleted from %; end or revoke the record', TG_TABLE_NAME;
END $$;

CREATE OR REPLACE FUNCTION wl_forbid_audit_mutation() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'White-Label audit events are append-only';
END $$;

CREATE OR REPLACE FUNCTION wl_preserve_record_identity() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  column_name TEXT;
  before_row JSONB := to_jsonb(OLD);
  after_row JSONB := to_jsonb(NEW);
BEGIN
  FOREACH column_name IN ARRAY TG_ARGV LOOP
    IF before_row -> column_name IS DISTINCT FROM after_row -> column_name THEN
      RAISE EXCEPTION 'White-Label column % is immutable on %', column_name, TG_TABLE_NAME;
    END IF;
  END LOOP;
  IF TG_TABLE_NAME IN ('organization_memberships', 'organization_role_assignments')
    AND before_row ->> 'status' = 'ended' AND after_row ->> 'status' <> 'ended' THEN
    RAISE EXCEPTION 'Ended history cannot be reactivated; create a new record';
  END IF;
  IF TG_TABLE_NAME = 'organization_memberships'
    AND before_row -> 'ended_at' <> 'null'::jsonb
    AND before_row -> 'ended_at' IS DISTINCT FROM after_row -> 'ended_at' THEN
    RAISE EXCEPTION 'Membership end evidence is immutable';
  END IF;
  IF TG_TABLE_NAME = 'organization_grants'
    AND before_row -> 'revoked_at' <> 'null'::jsonb
    AND before_row -> 'revoked_at' IS DISTINCT FROM after_row -> 'revoked_at' THEN
    RAISE EXCEPTION 'Revoked grants cannot be restored or moved';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION wl_validate_program_reference() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  expected_scope TEXT;
  subject_scope TEXT;
  subject_scope_id TEXT;
BEGIN
  IF NEW.scope_type = 'program' AND NOT EXISTS (
    SELECT 1 FROM public.v2_programs p
    WHERE p.id::text = NEW.scope_id AND p.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Programme scope must belong to the same organization';
  END IF;
  IF TG_TABLE_NAME = 'organization_role_assignments' THEN
    SELECT t.scope_type INTO expected_scope
    FROM public.organization_roles r
    JOIN public.organization_role_templates t ON t.key = r.template_key
    WHERE r.id = NEW.role_id AND r.organization_id = NEW.organization_id;
    IF expected_scope IS NULL OR expected_scope <> NEW.scope_type THEN
      RAISE EXCEPTION 'Role assignment exceeds its template scope';
    END IF;
  ELSIF NEW.subject_type = 'membership' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.id::text = NEW.subject_id AND m.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'Grant subject must belong to the same organization';
    END IF;
  ELSIF NEW.subject_type = 'role_assignment' THEN
    SELECT a.scope_type, a.scope_id INTO subject_scope, subject_scope_id
    FROM public.organization_role_assignments a
    WHERE a.id::text = NEW.subject_id AND a.organization_id = NEW.organization_id;
    IF subject_scope IS NULL THEN
      RAISE EXCEPTION 'Grant subject must belong to the same organization';
    END IF;
    IF NEW.effect = 'allow' AND subject_scope = 'program'
      AND (NEW.scope_type <> 'program' OR NEW.scope_id IS DISTINCT FROM subject_scope_id) THEN
      RAISE EXCEPTION 'Allow grant cannot expand its assignment scope';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported grant subject';
  END IF;
  RETURN NEW;
END $$;

-- Protect references after assignment creation as well as on initial INSERT.
CREATE OR REPLACE FUNCTION wl_preserve_program_references() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR
      COALESCE(NEW.organization_id, '00000000-0000-4000-8000-000000000001'::UUID)
      IS DISTINCT FROM
      COALESCE(OLD.organization_id, '00000000-0000-4000-8000-000000000001'::UUID) THEN
      RAISE EXCEPTION 'Programme identity and organization ownership are immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organization_role_assignments a
    WHERE a.scope_type = 'program' AND a.scope_id = OLD.id::text
  ) OR EXISTS (
    SELECT 1 FROM public.organization_grants g
    WHERE g.scope_type = 'program' AND g.scope_id = OLD.id::text
  ) THEN
    RAISE EXCEPTION 'Programme referenced by White-Label history must be archived, not deleted';
  END IF;
  RETURN OLD;
END $$;

-- Invoker rights: no privilege escalation. The server role must have INSERT
-- access to the protected audit table. No credentials or session tokens logged.
CREATE OR REPLACE FUNCTION wl_audit_lifecycle_change() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  before_row JSONB;
  after_row JSONB := to_jsonb(NEW);
  changed_before JSONB;
  changed_after JSONB;
  event_org UUID;
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
  event_org := CASE WHEN TG_TABLE_NAME = 'organizations' THEN NEW.id
    ELSE (after_row ->> 'organization_id')::UUID END;
  INSERT INTO public.organization_audit_events
    (organization_id, actor_person_id, actor_role, action, entity_type, entity_id,
     before, after, metadata, request_id)
  VALUES (event_org, NULLIF(current_setting('app.actor_person_id', TRUE), ''), CURRENT_USER,
    lower(TG_OP), TG_TABLE_NAME, after_row ->> 'id', changed_before, changed_after,
    jsonb_build_object('source', 'database-trigger'),
    NULLIF(current_setting('app.request_id', TRUE), ''));
  RETURN NEW;
END $$;

-- Refuse inconsistent pre-existing new-scheme records instead of rewriting or
-- deleting them. This is a preflight, not a claim of validation on a live DB.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organization_role_assignments a
    JOIN public.organization_roles r ON r.id = a.role_id AND r.organization_id = a.organization_id
    JOIN public.organization_role_templates t ON t.key = r.template_key
    WHERE a.scope_type <> t.scope_type OR (a.scope_type = 'program' AND NOT EXISTS (
      SELECT 1 FROM public.v2_programs p WHERE p.id::text = a.scope_id AND p.organization_id = a.organization_id
    ))
  ) OR EXISTS (
    SELECT 1 FROM public.organization_grants g
    WHERE (g.scope_type = 'program' AND NOT EXISTS (
      SELECT 1 FROM public.v2_programs p WHERE p.id::text = g.scope_id AND p.organization_id = g.organization_id
    )) OR (g.subject_type = 'membership' AND NOT EXISTS (
      SELECT 1 FROM public.organization_memberships m WHERE m.id::text = g.subject_id AND m.organization_id = g.organization_id
    )) OR (g.subject_type = 'role_assignment' AND NOT EXISTS (
      SELECT 1 FROM public.organization_role_assignments a
      WHERE a.id::text = g.subject_id AND a.organization_id = g.organization_id
        AND (g.effect = 'deny' OR a.scope_type = 'organization'
          OR (g.scope_type = 'program' AND g.scope_id = a.scope_id))
    ))
  ) THEN
    RAISE EXCEPTION 'Invalid White-Label scope records; review required, no records changed';
  END IF;
END $$;

-- Trigger installation is repeatable without dropping any existing object.
DO $$
DECLARE
  target_table TEXT;
  immutable_columns TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['organizations', 'organization_contracts',
    'organization_modules', 'organization_memberships', 'organization_roles',
    'organization_role_assignments', 'organization_grants'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || target_table)::regclass AND tgname = 'wl_history_no_delete') THEN
      EXECUTE format('CREATE TRIGGER wl_history_no_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wl_forbid_history_delete()', target_table);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || target_table)::regclass AND tgname = 'wl_history_no_truncate') THEN
      EXECUTE format('CREATE TRIGGER wl_history_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.wl_forbid_history_delete()', target_table);
    END IF;
    immutable_columns := CASE target_table
      WHEN 'organizations' THEN '''id'', ''is_platform'', ''created_at'''
      WHEN 'organization_memberships' THEN '''id'', ''organization_id'', ''person_id'', ''created_at'''
      WHEN 'organization_roles' THEN '''id'', ''organization_id'', ''template_key'', ''created_at'''
      WHEN 'organization_role_assignments' THEN '''id'', ''organization_id'', ''membership_id'', ''role_id'', ''scope_type'', ''scope_id'', ''starts_at'', ''created_at'''
      WHEN 'organization_grants' THEN '''id'', ''organization_id'', ''subject_type'', ''subject_id'', ''module'', ''capability'', ''effect'', ''access_level'', ''scope_type'', ''scope_id'', ''starts_at'', ''ends_at'', ''created_at'''
      WHEN 'organization_modules' THEN '''id'', ''organization_id'', ''module_key'', ''created_at'''
      ELSE '''id'', ''organization_id'', ''created_at''' END;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || target_table)::regclass AND tgname = 'wl_history_identity') THEN
      EXECUTE format('CREATE TRIGGER wl_history_identity BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wl_preserve_record_identity(%s)', target_table, immutable_columns);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || target_table)::regclass AND tgname = 'wl_history_audit') THEN
      EXECUTE format('CREATE TRIGGER wl_history_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wl_audit_lifecycle_change()', target_table);
    END IF;
  END LOOP;
  FOREACH target_table IN ARRAY ARRAY['organization_role_assignments', 'organization_grants'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid = ('public.' || target_table)::regclass AND tgname = 'wl_program_scope') THEN
      EXECUTE format('CREATE TRIGGER wl_program_scope BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wl_validate_program_reference()', target_table);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.organization_audit_events'::regclass AND tgname = 'wl_audit_append_only') THEN
    CREATE TRIGGER wl_audit_append_only BEFORE UPDATE OR DELETE ON public.organization_audit_events
      FOR EACH ROW EXECUTE FUNCTION wl_forbid_audit_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.organization_audit_events'::regclass AND tgname = 'wl_audit_no_truncate') THEN
    CREATE TRIGGER wl_audit_no_truncate BEFORE TRUNCATE ON public.organization_audit_events
      FOR EACH STATEMENT EXECUTE FUNCTION wl_forbid_audit_mutation();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.v2_programs'::regclass AND tgname = 'wl_program_identity') THEN
    CREATE TRIGGER wl_program_identity BEFORE UPDATE OF id, organization_id OR DELETE ON public.v2_programs
      FOR EACH ROW EXECUTE FUNCTION wl_preserve_program_references();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.organization_role_templates'::regclass AND tgname = 'wl_template_scope_identity') THEN
    CREATE TRIGGER wl_template_scope_identity BEFORE UPDATE ON public.organization_role_templates
      FOR EACH ROW EXECUTE FUNCTION wl_preserve_record_identity('key', 'scope_type');
  END IF;
END $$;
COMMIT;
