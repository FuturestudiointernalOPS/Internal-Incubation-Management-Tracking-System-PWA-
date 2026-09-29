-- Venture Journeys / milestones — the held state split.
--
-- `locked` used to carry two different meanings at once: a Journey that had not
-- started yet, and a milestone an explicit dependency was holding back. Those
-- are now two separate states, so a person can tell them apart in the UI:
--
--   journey stage  locked -> upcoming    (its start date has not arrived)
--   milestone      locked -> upcoming    (its Journey has not started)
--   milestone      locked -> blocked     (Journey active, a dependency is unmet)
--   milestone      locked -> not_started (Journey active, nothing holds it)
--
-- SAFE: idempotent — after the first run no `locked` rows remain, so a second
-- run proposes nothing. It never touches `completed` work and never deletes.
--
-- The app's ensureJourneyTable() sets the same default defensively on every
-- request path; this file is the record-of-change for the databases.

ALTER TABLE public.venture_journey_stages ALTER COLUMN status SET DEFAULT 'upcoming';

-- 1. Journeys that had not started.
UPDATE public.venture_journey_stages SET status = 'upcoming' WHERE status = 'locked';

-- 2. Milestones of a Journey that is not active are unreleased planning.
UPDATE public.venture_milestones m
   SET status = 'upcoming', updated_at = NOW()
 WHERE m.status = 'locked'
   AND m.journey_stage_id IN (
     SELECT s.id FROM public.venture_journey_stages s WHERE s.status <> 'active'
   );

-- 3. Held milestones of an ACTIVE Journey: `blocked` when a dependency is unmet.
UPDATE public.venture_milestones m
   SET status = 'blocked', updated_at = NOW()
 WHERE m.status = 'locked'
   AND m.journey_stage_id IN (
     SELECT s.id FROM public.venture_journey_stages s WHERE s.status = 'active'
   )
   AND EXISTS (
     SELECT 1 FROM public.venture_dependencies d
     JOIN public.venture_milestones blocker ON blocker.id::text = d.source_id
     WHERE d.venture_id::text = m.venture_id::text
       AND d.target_type = 'milestone' AND d.target_id = m.id::text
       AND d.source_type = 'milestone' AND blocker.status <> 'completed'
   );

-- 4. Whatever is still `locked` sits in an active Journey with nothing holding
--    it back — offer it.
UPDATE public.venture_milestones
   SET status = 'not_started', updated_at = NOW()
 WHERE status = 'locked'
   AND journey_stage_id IN (
     SELECT s.id FROM public.venture_journey_stages s WHERE s.status = 'active'
   );
