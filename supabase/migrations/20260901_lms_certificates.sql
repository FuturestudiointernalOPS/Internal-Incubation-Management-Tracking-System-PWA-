-- =============================================================================
-- IMPACTOS LMS — PHASE 5 CERTIFICATES (supabase/migrations/20260901_lms_certificates.sql)
-- -----------------------------------------------------------------------------
-- Creates the certificate layer on top of the Phase 1-4 LMS:
--   * one certificate per completed enrollment (UNIQUE enrollment_id — the DB
--     enforces "no accidental duplicates", never only application code)
--   * authoritative snapshots of learner name + course title at issuance so an
--     issued certificate stays historically stable (course renames don't
--     rewrite old certificates)
--   * a random, non-guessable verification_token for the public verification
--     URL (certificate_number is sequential per year and stays private-ish)
--   * minimal status lifecycle: valid -> revoked (records are never deleted;
--     the historical record must remain auditable)
--
-- Rules honoured (Phase 1 conventions, docs/LMS_ARCHITECTURE.md):
--   * Additive only: creates ONE new table, touches NO existing tables.
--   * Idempotent: every statement is CREATE ... IF NOT EXISTS — safe to re-run.
--   * Identity = existing contacts.cid; no lms_users table, no second
--     identity system.
--   * Completion state stays authoritative on lms_enrollments
--     (status + completed_at). The certificate is a CONSEQUENCE of completion,
--     never the source of it — the completion engine is untouched here.
-- Apply via the Supabase SQL editor (production: main branch; staging: dev).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lms_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- internal id — NEVER exposed as the certificate number
    certificate_number TEXT NOT NULL UNIQUE,          -- CERT-<YYYY>-<NNNNNN> — the public-facing certificate ID
    verification_token TEXT NOT NULL UNIQUE,          -- random; used by the public verification URL
    enrollment_id UUID NOT NULL UNIQUE REFERENCES lms_enrollments(id) ON DELETE CASCADE,  -- one cert per completed enrollment
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    user_cid TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,  -- existing ImpactOS identity
    learner_name TEXT NOT NULL,                       -- authoritative snapshot at issuance (historical integrity)
    course_title TEXT NOT NULL,                       -- authoritative snapshot at issuance (historical integrity)
    issued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'valid'
        CHECK (status IN ('valid', 'revoked')),      -- V1: minimal status; records are never deleted
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lms_certificates_user ON lms_certificates(user_cid);
CREATE INDEX IF NOT EXISTS idx_lms_certificates_course ON lms_certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_certificates_status ON lms_certificates(status);

COMMIT;
