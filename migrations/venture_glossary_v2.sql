-- =============================================================================
-- VENTURE GLOSSARY v2 — corrected definitions + the derived metrics
--
-- One-time correction: `paying_customer` described "paid at some point during
-- the month", while the form asks for the CLOSING count and churn is
-- `start + new − end`. Those are two different numbers. The corrected
-- definition is a stock at month end.
--
-- Idempotent: ON CONFLICT (term) DO UPDATE. Re-running writes the same text.
-- Contract of scripts/db-audit/apply-schema-file.mjs: one statement per line,
-- each terminated by ';', no ';' inside string literals.
-- =============================================================================

INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES ('paying_customer', 'A customer whose paid subscription is active at the end of the reporting month. Free trials and pilots that have not converted to paid are excluded.', 'Un client dont l''abonnement payant est actif à la fin du mois de référence. Les essais gratuits et les pilotes non convertis sont exclus.') ON CONFLICT (term) DO UPDATE SET definition_en = EXCLUDED.definition_en, definition_fr = EXCLUDED.definition_fr, updated_at = NOW();
INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES ('mrr', 'Monthly recurring revenue from subscriptions, excluding one-off income.', 'Revenu récurrent mensuel des abonnements, hors revenus ponctuels.') ON CONFLICT (term) DO UPDATE SET definition_en = EXCLUDED.definition_en, definition_fr = EXCLUDED.definition_fr, updated_at = NOW();
INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES ('active_user', 'A person who used the product at least once during the reporting month.', 'Une personne ayant utilisé le produit au moins une fois pendant le mois de référence.') ON CONFLICT (term) DO UPDATE SET definition_en = EXCLUDED.definition_en, definition_fr = EXCLUDED.definition_fr, updated_at = NOW();
INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES ('fte', 'Full-time employees + (part-time days worked ÷ 20) + full-time founders.', 'Employés à temps plein + (jours travaillés à temps partiel ÷ 20) + fondateurs à temps plein.') ON CONFLICT (term) DO UPDATE SET definition_en = EXCLUDED.definition_en, definition_fr = EXCLUDED.definition_fr, updated_at = NOW();
INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES ('churn_rate', 'Lost customers divided by paying customers at the start of the month. Lost = paying at start + new − paying at end.', 'Clients perdus divisés par les clients payants en début de mois. Perdus = payants en début + nouveaux − payants en fin.') ON CONFLICT (term) DO UPDATE SET definition_en = EXCLUDED.definition_en, definition_fr = EXCLUDED.definition_fr, updated_at = NOW();
INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES ('retention', '1 − churn rate: the share of paying customers who stayed during the month.', '1 − taux d''attrition : la part des clients payants restés pendant le mois.') ON CONFLICT (term) DO UPDATE SET definition_en = EXCLUDED.definition_en, definition_fr = EXCLUDED.definition_fr, updated_at = NOW();
INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES ('arpu', 'MRR divided by paying customers at the end of the month.', 'MRR divisé par les clients payants à la fin du mois.') ON CONFLICT (term) DO UPDATE SET definition_en = EXCLUDED.definition_en, definition_fr = EXCLUDED.definition_fr, updated_at = NOW();
INSERT INTO venture_glossary (term, definition_en, definition_fr) VALUES ('ltv', 'ARPU × customer lifetime, where lifetime = 1 ÷ churn rate. Not applicable when churn is zero.', 'ARPU × durée de vie client, où durée de vie = 1 ÷ taux d''attrition. Non applicable si l''attrition est nulle.') ON CONFLICT (term) DO UPDATE SET definition_en = EXCLUDED.definition_en, definition_fr = EXCLUDED.definition_fr, updated_at = NOW();
