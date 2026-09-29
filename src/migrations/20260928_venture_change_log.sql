-- VENTURE CHANGE LOG — the field-level record of what changed on a Venture.
--
-- Same SHAPE as `task_audit_logs` (action + field_name / old_value / new_value +
-- who + when), generalised to Journeys, Milestones and everything an import
-- creates. It is a SEPARATE table on purpose: `task_audit_logs.task_id` is an
-- INTEGER NOT NULL foreign key to the Operations OS `tasks` table, so "widening"
-- it would mean altering a live table shared with another module and making its
-- key nullable. A venture-scoped sibling keeps the identical field-level shape
-- without reaching into the operations domain.
--
-- Writers are the CHOKE POINTS (journey PATCH, milestone PATCH, plan apply) and
-- every write is NON-FATAL: an audit row is never more important than the change
-- it describes, so a failure here is logged, never raised.
--
-- No backfill: this records what happens from now on. Nothing that happened
-- before it existed is invented after the fact.
CREATE TABLE IF NOT EXISTS public.venture_change_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE, entity_type text NOT NULL, entity_id text, entity_label text, action text NOT NULL, field_name text, old_value text, new_value text, actor_cid text, actor_name text, metadata jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS venture_change_log_venture_idx ON public.venture_change_log (venture_id, created_at DESC);
CREATE INDEX IF NOT EXISTS venture_change_log_entity_idx ON public.venture_change_log (venture_id, entity_type, entity_id);
