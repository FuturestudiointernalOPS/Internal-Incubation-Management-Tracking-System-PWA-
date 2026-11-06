-- A.11 — bilingual studio-editable decline reason lists.
BEGIN;

CREATE TABLE IF NOT EXISTS investor_decline_reasons (
  id BIGSERIAL PRIMARY KEY,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('intro', 'investment', 'application', 'pass', 'deal_flow_close')),
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_decline_reasons_applies
  ON investor_decline_reasons (applies_to, active, sort_order);

INSERT INTO investor_decline_reasons (applies_to, name_en, name_fr, sort_order)
SELECT * FROM (VALUES
  ('intro', 'Not ready for introductions now', 'Pas prêt pour des introductions pour le moment', 1),
  ('intro', 'The raise is paused or closed', 'La levée est en pause ou clôturée', 2),
  ('intro', 'Not a fit for this investor', 'Pas adapté à cet investisseur', 3),
  ('intro', 'Other', 'Autre', 99),
  ('investment', 'Figures do not match', 'Les montants ne correspondent pas', 1),
  ('investment', 'Instrument not confirmed', 'Instrument non confirmé', 2),
  ('investment', 'Duplicate claim', 'Déclaration en double', 3),
  ('investment', 'Other', 'Autre', 99),
  ('pass', 'Not a fit right now', 'Pas adapté pour le moment', 1),
  ('pass', 'Ticket size mismatch', 'Ticket hors fourchette', 2),
  ('pass', 'Other', 'Autre', 99),
  ('deal_flow_close', 'Raised', 'Levée réalisée', 1),
  ('deal_flow_close', 'Withdrawn', 'Retirée', 2),
  ('deal_flow_close', 'Expired', 'Expirée', 3),
  ('deal_flow_close', 'Other', 'Autre', 99),
  ('application', 'Incomplete application', 'Candidature incomplète', 1),
  ('application', 'Not a fit', 'Pas adapté', 2),
  ('application', 'Other', 'Autre', 99)
) AS seed(applies_to, name_en, name_fr, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM investor_decline_reasons LIMIT 1);

COMMIT;
