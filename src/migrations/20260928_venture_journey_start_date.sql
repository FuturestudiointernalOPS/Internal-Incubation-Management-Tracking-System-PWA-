-- Venture Journeys: date-driven activation (overlapping journeys).
--
-- A locked Journey becomes active when its own start_date arrives
-- (ventureMilestoneEngine.activateDueStages) — never by waiting for another
-- Journey to complete. Nullable on purpose: NULL = never auto-activates; such
-- a Journey starts only when a staff member activates it explicitly.
--
-- The app's ensureJourneyTable() adds the same column defensively; this file
-- is the record-of-change for the databases.
ALTER TABLE public.venture_journey_stages ADD COLUMN IF NOT EXISTS start_date date;
