-- Lift the blanket preparation lock at the owner's explicit request.
-- Apply explicitly after the existing white-label migrations; never via initDb.
-- No business rows, contracts, memberships, modules or roles are changed here.
-- This permits activation; it does not certify isolation or activate any client.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Keep the existing triggers and identity protections. Only the unconditional
-- refusals of active clients and client-owned programme INSERTs are removed.
-- Application authorization, history/audit triggers, RLS and scoped foreign
-- keys remain in force. Suspended organisations still fail access checks.
CREATE OR REPLACE FUNCTION public.wl_programs_preparation_guard() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
        OR NEW.is_platform IS DISTINCT FROM OLD.is_platform THEN
        RAISE EXCEPTION 'Organization identity is immutable';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'v2_programs' THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.id IS DISTINCT FROM OLD.id
        OR COALESCE(NEW.organization_id, '00000000-0000-4000-8000-000000000001'::UUID)
          IS DISTINCT FROM
          COALESCE(OLD.organization_id, '00000000-0000-4000-8000-000000000001'::UUID) THEN
        RAISE EXCEPTION 'Programme identity and organization ownership are immutable';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

COMMIT;
