-- =============================================================================
-- IMPACTOS LMS — CHECKOUT REGISTRATIONS (form run -> payment -> course access)
-- (supabase/migrations/20260924_lms_checkout_registrations.sql)
-- -----------------------------------------------------------------------------
-- The chain behind a PAID registration. The public form run (an "Execution")
-- stays the ONE form; it only gains a course and a payment.
--
--   1. platform_form_runs.lms_course_id — the course a run sells. NULL keeps the
--      run exactly as it behaves today (a free form), so nothing existing
--      changes. Additive, nullable, indexed.
--   2. lms_registrations — one row per person + course, captured BEFORE any
--      money moves (an abandoned or failed payment is a follow-up, not a lost
--      lead). Carries the stable non-personal REFERENCE the payment provider
--      echoes back, the SERVER-decided amount snapshot, and three INDEPENDENT
--      states: payment, access, email.
--   3. lms_payment_events — append-only journal of every provider notification,
--      including the ones we refuse (unknown reference, divergent amount,
--      success we could not verify). A refused notification is never dropped
--      silently.
--
-- Rules honoured:
--   * One reference = one registration: UNIQUE(reference), server-generated,
--     never reused, never derived from personal data.
--   * One person + one course = one registration: UNIQUE(course_id, email) with
--     `email` stored lowercased, so a retry after a failure UPDATES the row
--     instead of creating a second record.
--   * The same provider notification is never applied twice: a partial unique
--     index on (provider, provider_transaction_id, event_type), INSERTed with
--     ON CONFLICT DO NOTHING so a provider retry never raises.
--   * `course_id` is a real FK (ON DELETE SET NULL): retiring a course keeps the
--     payment/audit trail. A detached registration deliberately escapes the
--     person+course uniqueness — documented, acceptable.
--   * Idempotent: IF NOT EXISTS everywhere — safe to re-run.
-- -----------------------------------------------------------------------------
-- Apply via the Supabase SQL editor (production: main branch; staging: dev).
-- =============================================================================

BEGIN;

-- ── 1. A run may sell a course ───────────────────────────────────────────────

ALTER TABLE platform_form_runs
    ADD COLUMN IF NOT EXISTS lms_course_id UUID;

CREATE INDEX IF NOT EXISTS idx_platform_form_runs_lms_course
    ON platform_form_runs(lms_course_id);

-- ── 2. Registrations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lms_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT NOT NULL UNIQUE,             -- public id, e.g. REG-2026-1A2B3C4D
    run_id INTEGER,                             -- platform_form_runs.id (the Execution)
    submission_id INTEGER,                      -- platform_form_submissions.id
    course_id UUID REFERENCES lms_courses(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,                        -- stored LOWERCASE (see the unique index)
    phone TEXT,
    language TEXT NOT NULL DEFAULT 'en',        -- drives the language of the receipt
    amount NUMERIC(10,2) NOT NULL,              -- server-decided price snapshot
    currency TEXT NOT NULL DEFAULT 'XOF',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
    provider TEXT,                              -- 'kkiapay'
    provider_transaction_id TEXT,
    partner_id TEXT,                            -- what the widget sent back as partnerId
    access_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (access_status IN ('pending', 'granted', 'failed')),
    access_error TEXT,                          -- why the access step failed (replayable)
    email_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (email_status IN ('pending', 'sent', 'failed')),
    user_cid TEXT,                              -- contacts.cid created/linked on fulfillment
    consent_at TIMESTAMPTZ,                     -- when the visitor consented to the capture
    paid_at TIMESTAMPTZ,                        -- also the start of the short access window
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    -- The "come back and finish" link emailed to the owner of an EXISTING unpaid
    -- registration. Stored as a HASH only: the link never sits at rest usable.
    resume_token_hash TEXT,
    resume_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_registrations_reference
    ON lms_registrations(reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_registrations_course_email
    ON lms_registrations(course_id, email);
CREATE INDEX IF NOT EXISTS idx_lms_registrations_course
    ON lms_registrations(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_registrations_run
    ON lms_registrations(run_id);
CREATE INDEX IF NOT EXISTS idx_lms_registrations_status
    ON lms_registrations(status);
CREATE INDEX IF NOT EXISTS idx_lms_registrations_user
    ON lms_registrations(user_cid);
CREATE INDEX IF NOT EXISTS idx_lms_registrations_email
    ON lms_registrations(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_registrations_resume_token
    ON lms_registrations(resume_token_hash)
    WHERE resume_token_hash IS NOT NULL;

-- ── 3. Payment journal ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lms_payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID REFERENCES lms_registrations(id) ON DELETE SET NULL,
    reference TEXT,
    run_id INTEGER,
    provider TEXT,
    event_type TEXT,
    provider_transaction_id TEXT,
    partner_id TEXT,
    amount NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    message TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lms_payment_events_registration
    ON lms_payment_events(registration_id);
CREATE INDEX IF NOT EXISTS idx_lms_payment_events_transaction
    ON lms_payment_events(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_lms_payment_events_reference
    ON lms_payment_events(reference);

-- The same provider notification must never be applied twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_payment_events_unique_event
    ON lms_payment_events(provider, provider_transaction_id, event_type)
    WHERE provider_transaction_id IS NOT NULL AND event_type IS NOT NULL;

COMMIT;
