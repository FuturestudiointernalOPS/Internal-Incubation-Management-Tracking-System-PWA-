ALTER TABLE families ADD COLUMN IF NOT EXISTS form_id UUID;
CREATE INDEX IF NOT EXISTS idx_families_form_id ON families(form_id);
