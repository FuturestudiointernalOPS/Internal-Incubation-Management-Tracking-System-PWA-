-- CORRECTION — an external assignment is a NAME ON THE ASSIGNMENT, not a person.
--
-- The first cut of this feature created a `venture_people` row for every name
-- with no account, and later "promoted" that row to a member by filling in its
-- contact_id. That was wrong. It turned a REFERENCE into a PERSON ENTITY, and it
-- meant a name typed into a tracker could become an ImpactOS person.
--
-- THE RULE: a tracker name is a reference, never an account.
--
--   Platform member      -> has an account; identified by a CID
--   External assignment  -> a NAME recorded against the work: no account, no row
--                           of its own, and nothing that can be promoted
--
-- So the assignment carries `contact_id` (nullable) and `name` (nullable) and
-- needs AT LEAST ONE of them. Resolving an external assignment later means
-- setting the contact id and leaving the name — and the history — alone.
--
-- A real ImpactOS person still requires Name + Email + Phone, is created through
-- the platform's own person flow, and is invited BY EMAIL. Never from a tracker.
--
-- `IF EXISTS` throughout: none of these objects ever reached production, so this
-- file is a no-op there. It removes them from the database where they were
-- created during the mistaken first cut.
ALTER TABLE public.venture_tasks DROP COLUMN IF EXISTS assignee_person_id;
ALTER TABLE public.venture_milestones DROP COLUMN IF EXISTS owner_person_id;
ALTER TABLE public.venture_deliverables DROP COLUMN IF EXISTS assigned_person_id;
ALTER TABLE public.venture_journey_stages DROP COLUMN IF EXISTS owner_person_id;
DROP TABLE IF EXISTS public.venture_people;
-- The NAME half of an assignment, so every level can hold an external name.
-- Tasks and deliverables already carry one; milestones and journeys did not.
ALTER TABLE public.venture_milestones ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE public.venture_journey_stages ADD COLUMN IF NOT EXISTS owner_name text;
