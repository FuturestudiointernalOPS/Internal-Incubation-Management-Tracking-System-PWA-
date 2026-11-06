BEGIN;

CREATE TABLE IF NOT EXISTS investor_types (
  id BIGSERIAL PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO investor_types (name_en, name_fr, sort_order)
SELECT * FROM (VALUES
  ('Angel', 'Business angel', 1),
  ('Fund', 'Fonds', 2),
  ('Family office', 'Family office', 3),
  ('DFI', 'IFD', 4),
  ('Foundation', 'Fondation', 5),
  ('Corporate', 'Corporate', 6),
  ('Syndicate', 'Syndicat', 7),
  ('Other', 'Autre', 99)
) AS seed(name_en, name_fr, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM investor_types LIMIT 1);

ALTER TABLE deal_flow_entries
  ADD COLUMN IF NOT EXISTS show_founder_names BOOLEAN DEFAULT false;

COMMIT;
