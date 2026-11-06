-- Additive profile extensions, applied explicitly before dashboard v2 activation.
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS past_investments TEXT;
