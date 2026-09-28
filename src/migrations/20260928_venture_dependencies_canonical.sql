-- Venture dependencies — canonical id types. The table is EMPTY on both
-- databases (verified); schema-only.
--
-- One edge shape holds both entity kinds: milestones are UUIDs, tasks are
-- integers, so entity ids live as TEXT. An edge (source -> target) means the
-- source BLOCKS the target (finish_to_start), enforced by the engine's
-- release/booking gates; cycles (including transitive) are refused in code.
ALTER TABLE public.venture_dependencies ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.venture_dependencies ALTER COLUMN id TYPE uuid USING gen_random_uuid();
ALTER TABLE public.venture_dependencies ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.venture_dependencies ALTER COLUMN venture_id TYPE uuid USING venture_id::uuid;
ALTER TABLE public.venture_dependencies ALTER COLUMN source_id TYPE text USING source_id::text;
ALTER TABLE public.venture_dependencies ALTER COLUMN target_id TYPE text USING target_id::text;
ALTER TABLE public.venture_dependencies ADD CONSTRAINT venture_dependencies_venture_id_fkey FOREIGN KEY (venture_id) REFERENCES public.ventures(id) ON DELETE CASCADE;
