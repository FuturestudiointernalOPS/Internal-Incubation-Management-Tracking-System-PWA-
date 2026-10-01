-- Venture tasks gain a planned start date.
--
-- The review screen lets a reviewer correct the tracker's task Start dates, and
-- Apply has to put them somewhere. `venture_tasks` only ever had `due_date`, so
-- those dates would have been silently dropped on the way in.
--
-- Nullable and additive: nothing reads it yet, every existing row stays valid,
-- and the column can be dropped without touching a single row.
ALTER TABLE public.venture_tasks ADD COLUMN IF NOT EXISTS start_date date;
