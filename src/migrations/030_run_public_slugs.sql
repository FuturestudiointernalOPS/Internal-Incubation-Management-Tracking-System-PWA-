-- =============================================================================
-- ADD PUBLIC SLUGS TO FORM RUNS — prevents ID guessing in public URLs
-- =============================================================================

ALTER TABLE platform_form_runs ADD COLUMN IF NOT EXISTS public_slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_runs_slug ON platform_form_runs(public_slug) WHERE public_slug IS NOT NULL;

-- Generate slugs for existing runs (hash of id + timestamp)
UPDATE platform_form_runs SET public_slug = encode(sha256(concat(id::text, created_at::text)::bytea), 'hex')::text WHERE public_slug IS NULL;
