-- =============================================================================
-- IMPACTOS — DATA BANK DOCUMENT TYPES: "counts for readiness"
--
-- A Venture's Data bank used to hold two kinds of document without saying which
-- one it was: documents that feed the Investment Readiness score, and documents
-- that are simply filed there. `is_readiness` draws that line.
--
-- TRUE  — the document is part of the readiness criteria: it counts in the
--         denominator and its verified/rejected status moves the score.
-- FALSE — the document is stored and shown in the Data bank, but leaves the
--         readiness percentage alone.
--
-- DEFAULT TRUE on purpose: every row that exists today was counting, and every
-- built-in type still does. A document an admin creates from the Data bank
-- screen starts at FALSE instead (see createVentureDocumentType), because
-- inventing a new requirement is a deliberate act.
--
-- Readiness recomputes on demand from this flag (src/models/ventureReadiness.js)
-- — there is no stored percentage to backfill.
--
-- Idempotent: safe to run more than once. A deployment that migrates the
-- database itself (SKIP_RUNTIME_SCHEMA_MAINTENANCE=true) must apply this file;
-- otherwise the ALTER in ensureVentureDocumentTypesTable() covers it at runtime.
-- =============================================================================

ALTER TABLE venture_document_types
    ADD COLUMN IF NOT EXISTS is_readiness BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- SELECT venture_id, code, label_en, required, is_readiness
--   FROM venture_document_types ORDER BY venture_id, sort_order;
--
-- Readiness documents only, i.e. what the Investment % is computed over:
-- SELECT venture_id, COUNT(*) AS readiness_criteria
--   FROM venture_document_types
--  WHERE is_active = TRUE AND required = TRUE AND is_readiness = TRUE
--  GROUP BY venture_id;