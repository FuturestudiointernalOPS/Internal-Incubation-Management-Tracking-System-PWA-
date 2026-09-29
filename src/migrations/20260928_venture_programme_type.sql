-- PROGRAMME TYPE — a LABEL on the Venture, not a new layer in the hierarchy.
--
-- Future Studio supports businesses at very different points: one is being built
-- from nothing, another already has a product, customers and revenue but needs to
-- rebuild its go-to-market. Those need different WORK, not a different structure.
-- The hierarchy stays Venture → Journey → Milestone → Task; how the engagement is
-- being run is a characteristic of it.
--
-- The values live in venture_option_values so Future Studio can rename them or
-- add a fourth without a code change — the same mechanism as business_stage and
-- industry already use.
ALTER TABLE public.ventures ADD COLUMN IF NOT EXISTS programme_type text;
INSERT INTO public.venture_option_values (option_type, value, label, sort_order) SELECT 'programme_type', 'incubation', 'Incubation', 1 WHERE NOT EXISTS (SELECT 1 FROM public.venture_option_values WHERE option_type = 'programme_type' AND value = 'incubation');
INSERT INTO public.venture_option_values (option_type, value, label, sort_order) SELECT 'programme_type', 'acceleration', 'Acceleration', 2 WHERE NOT EXISTS (SELECT 1 FROM public.venture_option_values WHERE option_type = 'programme_type' AND value = 'acceleration');
INSERT INTO public.venture_option_values (option_type, value, label, sort_order) SELECT 'programme_type', 'hybrid', 'Hybrid', 3 WHERE NOT EXISTS (SELECT 1 FROM public.venture_option_values WHERE option_type = 'programme_type' AND value = 'hybrid');
