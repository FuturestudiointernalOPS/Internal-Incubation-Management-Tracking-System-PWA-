-- =============================================================================
-- IMPACTOS — DATA BANK DOCUMENT TYPES (per Venture)
--
-- The documents a Venture is asked for in its Data bank. They used to be six
-- hardcoded categories; they are now a list that belongs to the VENTURE, defined
-- by a Super Admin or by that Venture's Lead Manager, at
-- /admin/ventures/<venture>/document-types and /staff/ventures/<venture>/document-types.
--
-- `venture_id` is the Venture's public code (VNT-…), the same value
-- `venture_verifications.venture_id` holds, so the whole Data bank is keyed the
-- same way.
--
-- The codes are what `venture_verification_items.category` and
-- `venture_verification_documents.category` reference — a type is retired with
-- `is_active = FALSE`, never by renaming its code.
--
-- Idempotent: safe to run more than once. The application also creates this
-- table on first use (src/models/ventureDocumentTypes.js), so a deployment that
-- migrates the database itself (SKIP_RUNTIME_SCHEMA_MAINTENANCE=true) must apply
-- this file.
--
-- NO SEED HERE ON PURPOSE: every Venture's six built-in types are created the
-- first time its list is needed, whatever already has rows. Seeding here would
-- have to guess which Ventures exist and would seed them all at once.
-- =============================================================================

CREATE TABLE IF NOT EXISTS venture_document_types (
    id SERIAL PRIMARY KEY,
    venture_id TEXT NOT NULL REFERENCES ventures(venture_id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    label_en TEXT NOT NULL,
    label_fr TEXT,
    description TEXT,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    verification_method TEXT NOT NULL DEFAULT 'upload',  -- upload | external
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(venture_id, code)
);

CREATE INDEX IF NOT EXISTS idx_venture_document_types_venture
    ON venture_document_types(venture_id, is_active, sort_order);

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- SELECT venture_id, code, label_en, required, verification_method, is_active
--   FROM venture_document_types ORDER BY venture_id, sort_order;
