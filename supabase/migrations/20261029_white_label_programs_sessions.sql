-- Additive cohort links reuse existing session records, without copying the
-- curriculum engine or changing existing rows. Client activation stays blocked.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
INSERT INTO organization_role_template_capabilities(template_key,module,capability,access_level) VALUES
 ('organization_program_editor','programs','sessions.manage',1),('program_coordinator','programs','sessions.manage',1)
ON CONFLICT(template_key,module,capability) DO NOTHING;
CREATE UNIQUE INDEX IF NOT EXISTS wl_sessions_id_program ON v2_sessions(id,program_id);
CREATE TABLE IF NOT EXISTS organization_program_session_links (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 program_id UUID NOT NULL, cohort_id UUID NOT NULL,
 duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK(duration_minutes BETWEEN 1 AND 1440),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 FOREIGN KEY(id,program_id) REFERENCES v2_sessions(id,program_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 FOREIGN KEY(cohort_id,program_id,organization_id) REFERENCES organization_program_cohorts(id,program_id,organization_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS wl_sessions_cohort ON organization_program_session_links(organization_id,program_id,cohort_id,id);
ALTER TABLE organization_program_session_links ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION wl_management_session_history() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE owner_row RECORD; cohort_status TEXT;
BEGIN
 IF TG_TABLE_NAME='v2_sessions' THEN
  SELECT l.*,c.status AS cohort_status INTO owner_row FROM public.organization_program_session_links l
   JOIN public.organization_program_cohorts c ON c.id=l.cohort_id AND c.organization_id=l.organization_id AND c.program_id=l.program_id
   WHERE l.id=OLD.id;
  IF NOT FOUND THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Client sessions must be archived, not deleted'; END IF;
  IF owner_row.cohort_status IN ('completed','archived') OR lower(OLD.status) IN ('completed','archived') THEN
   RAISE EXCEPTION 'Closed session history is immutable';
  END IF;
 ELSIF TG_TABLE_NAME='organization_program_cohorts' THEN
  IF NEW.status IN ('completed','archived') AND EXISTS (SELECT 1 FROM public.organization_program_session_links l
   JOIN public.v2_sessions s ON s.id=l.id AND s.program_id=l.program_id
   WHERE l.organization_id=NEW.organization_id AND l.cohort_id=NEW.id AND lower(COALESCE(s.status,'')) NOT IN ('completed','archived')) THEN
   RAISE EXCEPTION 'Close scheduled sessions before closing a cohort';
  END IF;
 ELSE
  SELECT status INTO cohort_status FROM public.organization_program_cohorts
   WHERE id=NEW.cohort_id AND program_id=NEW.program_id AND organization_id=NEW.organization_id FOR UPDATE;
  IF cohort_status IN ('completed','archived') THEN RAISE EXCEPTION 'Closed cohort cannot accept session changes'; END IF;
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.v2_sessions s WHERE s.id=OLD.id AND lower(s.status) IN ('completed','archived')) THEN RAISE EXCEPTION 'Closed session metadata is immutable'; END IF;
  IF TG_OP='UPDATE' AND NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Revision must increase by one'; END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='organization_program_session_links'::regclass AND tgname='wl_session_link_identity') THEN
  CREATE TRIGGER wl_session_link_identity BEFORE UPDATE ON organization_program_session_links FOR EACH ROW
   EXECUTE FUNCTION wl_preserve_record_identity('id','organization_id','program_id','cohort_id','created_at');
  CREATE TRIGGER wl_session_link_open BEFORE INSERT OR UPDATE ON organization_program_session_links FOR EACH ROW EXECUTE FUNCTION wl_management_session_history();
  CREATE TRIGGER wl_session_link_no_delete BEFORE DELETE ON organization_program_session_links FOR EACH ROW EXECUTE FUNCTION wl_forbid_history_delete();
  CREATE TRIGGER wl_session_link_no_truncate BEFORE TRUNCATE ON organization_program_session_links FOR EACH STATEMENT EXECUTE FUNCTION wl_forbid_history_delete();
  CREATE TRIGGER wl_session_link_audit AFTER INSERT OR UPDATE ON organization_program_session_links FOR EACH ROW EXECUTE FUNCTION wl_audit_lifecycle_change();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='v2_sessions'::regclass AND tgname='wl_client_session_history') THEN
  CREATE TRIGGER wl_client_session_history BEFORE UPDATE OR DELETE ON v2_sessions FOR EACH ROW EXECUTE FUNCTION wl_management_session_history();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='organization_program_cohorts'::regclass AND tgname='wl_cohort_sessions_closed') THEN
  CREATE TRIGGER wl_cohort_sessions_closed BEFORE UPDATE ON organization_program_cohorts FOR EACH ROW EXECUTE FUNCTION wl_management_session_history();
 END IF;
END $$;
COMMIT;
