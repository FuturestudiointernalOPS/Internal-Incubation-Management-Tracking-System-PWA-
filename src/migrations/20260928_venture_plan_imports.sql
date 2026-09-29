-- Programme import — the draft a reviewer decides on (Phase 2 of the plan import).
--
-- A tracker is an INPUT, never the source of truth: what the reading and the
-- analyst produced is stored HERE, a human corrects it, and only an approved
-- draft becomes journey rows (Phase 3 — not built yet). The proposal is JSONB
-- because it is the TRACKER's shape, not the platform's: dates, owners,
-- deliverables and dependency references are preserved verbatim so the review
-- has something real to correct.
--
-- The Journey template library cannot hold this draft. Those tables carry no
-- dates, no owners and no deliverables at all, so storing a proposal there
-- would silently discard everything the tracker actually contributes.
--
-- status: proposed (awaiting review) | applied (became journey rows) | discarded
CREATE TABLE IF NOT EXISTS public.venture_plan_imports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE, file_name text, file_kind text, sheets jsonb NOT NULL DEFAULT '[]'::jsonb, proposal jsonb NOT NULL, stats jsonb NOT NULL DEFAULT '{}'::jsonb, unmatched_owners jsonb NOT NULL DEFAULT '[]'::jsonb, warnings jsonb NOT NULL DEFAULT '[]'::jsonb, status text NOT NULL DEFAULT 'proposed', created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz, applied_by text);
CREATE INDEX IF NOT EXISTS venture_plan_imports_venture_idx ON public.venture_plan_imports (venture_id, created_at DESC);
CREATE INDEX IF NOT EXISTS venture_plan_imports_status_idx ON public.venture_plan_imports (venture_id, status);
