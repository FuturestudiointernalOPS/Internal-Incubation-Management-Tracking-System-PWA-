-- Additive preparation: explicit management roles and annual cohort history.
-- Does NOT unlock client activation, alter existing roles, backfill legacy data,
-- enrol clients in internal programmes, or register any runtime migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
INSERT INTO organization_role_templates (key,label_key,scope_type) VALUES
 ('organization_program_editor','common.organizationPortal.organizationEditor','organization'),
 ('program_coordinator','common.organizationPortal.programCoordinator','program')
ON CONFLICT (key) DO NOTHING;
INSERT INTO organization_role_template_capabilities (template_key,module,capability,access_level)
SELECT template_key,'programs',capability,1 FROM
 (VALUES ('organization_program_editor'),('program_coordinator')) roles(template_key)
 CROSS JOIN (VALUES ('view'),('edit'),('cohorts.manage'),('enrollments.manage')) caps(capability)
ON CONFLICT (template_key,module,capability) DO NOTHING;
INSERT INTO organization_role_template_capabilities (template_key,module,capability,access_level)
VALUES ('organization_program_editor','programs','create',1)
ON CONFLICT (template_key,module,capability) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_program_revisions (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0),
 FOREIGN KEY (id,organization_id) REFERENCES v2_programs(id,organization_id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS organization_program_cohorts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 program_id UUID NOT NULL, name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
 year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2200),
 status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','archived')),
 start_date DATE, end_date DATE, revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(id,program_id,organization_id), UNIQUE(program_id,year,name),
 FOREIGN KEY(program_id,organization_id) REFERENCES v2_programs(id,organization_id) ON DELETE RESTRICT,
 CHECK (start_date IS NULL OR end_date IS NULL OR start_date<=end_date)
);
CREATE TABLE IF NOT EXISTS organization_program_enrollments (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 program_id UUID NOT NULL, cohort_id UUID NOT NULL, membership_id UUID NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','withdrawn')),
 revision INTEGER NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ended_at TIMESTAMPTZ,
 UNIQUE(cohort_id,membership_id),
 FOREIGN KEY(cohort_id,program_id,organization_id)
   REFERENCES organization_program_cohorts(id,program_id,organization_id) ON DELETE RESTRICT,
 FOREIGN KEY(membership_id,organization_id) REFERENCES organization_memberships(id,organization_id) ON DELETE RESTRICT,
 CHECK ((status='active' AND ended_at IS NULL) OR (status<>'active' AND ended_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS wl_cohorts_program_year ON organization_program_cohorts(organization_id,program_id,year DESC,id);
CREATE INDEX IF NOT EXISTS wl_enrollments_cohort ON organization_program_enrollments(organization_id,program_id,cohort_id,id);
ALTER TABLE organization_program_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_program_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_program_enrollments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION wl_program_management_history() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF TG_TABLE_NAME='organization_program_cohorts' THEN
   IF NEW.year<>OLD.year THEN RAISE EXCEPTION 'Cohort year is immutable; create a new annual cohort'; END IF;
   IF OLD.status IN ('completed','archived') THEN RAISE EXCEPTION 'Closed cohort history is immutable'; END IF;
   IF NEW.status IN ('completed','archived') AND EXISTS (SELECT 1 FROM public.organization_program_enrollments e WHERE e.cohort_id=NEW.id AND e.organization_id=NEW.organization_id AND e.status='active') THEN
    RAISE EXCEPTION 'End active enrollments before closing a cohort';
   END IF;
  ELSIF TG_TABLE_NAME='organization_program_enrollments' THEN
   IF OLD.status<>'active' THEN RAISE EXCEPTION 'Ended enrollment history is immutable'; END IF;
  END IF;
  IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Revision must increase by one'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION wl_management_cohort_parent_open() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE program_status TEXT;
BEGIN
 SELECT status INTO program_status FROM public.v2_programs
  WHERE id=NEW.program_id AND organization_id=NEW.organization_id FOR UPDATE;
 IF lower(program_status) IN ('completed','archived') THEN
  RAISE EXCEPTION 'Closed programme cannot accept cohort changes';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION wl_management_enrollment_open() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE cohort_status TEXT;
BEGIN
 SELECT status INTO cohort_status FROM public.organization_program_cohorts
  WHERE id=NEW.cohort_id AND program_id=NEW.program_id AND organization_id=NEW.organization_id FOR UPDATE;
 IF cohort_status IN ('completed','archived') THEN RAISE EXCEPTION 'Closed cohort cannot accept enrollment changes'; END IF;
 IF TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM public.organization_memberships m JOIN public.contacts c ON c.cid=m.person_id
  WHERE m.id=NEW.membership_id AND m.organization_id=NEW.organization_id AND m.status='active' AND m.ended_at IS NULL
   AND (m.started_at IS NULL OR m.started_at<=clock_timestamp()) AND (m.expires_at IS NULL OR m.expires_at>clock_timestamp())
   AND c.deleted=0 AND c.status IN ('active','approved') AND lower(btrim(c.role)) IN ('member','participant','investor','founder','venture_owner','entrepreneur')) THEN
  -- The composite FK remains authoritative for cross-organisation references.
  -- Only reject an IN-organisation membership here; let invalid references fail FK.
  IF EXISTS (SELECT 1 FROM public.organization_memberships m WHERE m.id=NEW.membership_id AND m.organization_id=NEW.organization_id) THEN
   RAISE EXCEPTION 'An active organisation member is required';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION wl_management_program_history() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF OLD.organization_id IS NULL OR OLD.organization_id='00000000-0000-4000-8000-000000000001'::uuid THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Client programmes must be archived, not deleted'; END IF;
 IF lower(OLD.status) IN ('completed','archived') THEN RAISE EXCEPTION 'Closed programme history is immutable'; END IF;
 IF lower(NEW.status) IN ('completed','archived') AND EXISTS (SELECT 1 FROM public.organization_program_cohorts c
  WHERE c.organization_id=OLD.organization_id AND c.program_id=OLD.id AND c.status IN ('planned','active')) THEN
  RAISE EXCEPTION 'Close annual cohorts before closing a programme';
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tab TEXT; cols TEXT; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='organization_program_cohorts'::regclass AND tgname='wl_cohort_open_parent') THEN
  CREATE TRIGGER wl_cohort_open_parent BEFORE INSERT OR UPDATE ON organization_program_cohorts
   FOR EACH ROW EXECUTE FUNCTION wl_management_cohort_parent_open();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='organization_program_enrollments'::regclass AND tgname='wl_enrollment_open_cohort') THEN
  CREATE TRIGGER wl_enrollment_open_cohort BEFORE INSERT OR UPDATE ON organization_program_enrollments
   FOR EACH ROW EXECUTE FUNCTION wl_management_enrollment_open();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='v2_programs'::regclass AND tgname='wl_management_program_history') THEN
  CREATE TRIGGER wl_management_program_history BEFORE UPDATE OR DELETE ON v2_programs
   FOR EACH ROW EXECUTE FUNCTION wl_management_program_history();
  CREATE TRIGGER wl_management_program_audit AFTER INSERT OR UPDATE ON v2_programs
   FOR EACH ROW WHEN(NEW.organization_id IS NOT NULL AND NEW.organization_id<>'00000000-0000-4000-8000-000000000001'::uuid)
   EXECUTE FUNCTION wl_audit_lifecycle_change();
 END IF;
 FOREACH tab IN ARRAY ARRAY['organization_program_revisions','organization_program_cohorts','organization_program_enrollments'] LOOP
  cols:=CASE tab WHEN 'organization_program_revisions' THEN '''id'',''organization_id'''
   WHEN 'organization_program_cohorts' THEN '''id'',''organization_id'',''program_id'',''year'',''created_at'''
   ELSE '''id'',''organization_id'',''program_id'',''cohort_id'',''membership_id'',''created_at''' END;
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||tab)::regclass AND tgname='wl_management_identity') THEN
   EXECUTE format('CREATE TRIGGER wl_management_identity BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wl_preserve_record_identity(%s)',tab,cols);
   EXECUTE format('CREATE TRIGGER wl_management_history BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wl_program_management_history()',tab);
   EXECUTE format('CREATE TRIGGER wl_management_no_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wl_forbid_history_delete()',tab);
   EXECUTE format('CREATE TRIGGER wl_management_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.wl_forbid_history_delete()',tab);
  END IF;
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['organization_program_cohorts','organization_program_enrollments'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=('public.'||tab)::regclass AND tgname='wl_management_audit') THEN
   EXECUTE format('CREATE TRIGGER wl_management_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.wl_audit_lifecycle_change()',tab);
  END IF;
 END LOOP;
END $$;
COMMIT;
