-- =============================================================================
-- DELIVERABLES — Optional PM-provided Resource/Activity link
-- =============================================================================
-- Separates "what the Program Manager gives the participant to access"
-- (resource_url / resource_label) from "what the participant submits"
-- (allowed_format).
--
-- Run manually against the intended database. Idempotent.
-- =============================================================================

ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_url TEXT;
ALTER TABLE v2_document_requirements ADD COLUMN IF NOT EXISTS resource_label TEXT;
