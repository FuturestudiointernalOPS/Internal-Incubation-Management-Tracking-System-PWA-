import db from "@/lib/db";

/**
 * CHECKOUT REGISTRATIONS — self-healing schema.
 *
 * The schema contract, split verbatim out of `models/lms/registrations.js` — see
 * docs/LAYER_SPLIT.md.
 */

/**
 * SELF-HEALING SCHEMA — the same contract as
 * supabase/migrations/20260924_lms_checkout_registrations.sql, applied on first
 * use so a fresh environment works without a manual SQL step (the codebase's
 * existing convention — see ensureTokenHashColumns / ensurePasswordSetupTokensSchema).
 *
 * Every statement is IF NOT EXISTS, so it is a no-op once the migration has run.
 * Runs ONCE per process; a failure is logged, never fatal, and does not block a
 * read of tables that already exist.
 */
let checkoutSchemaPromise = null;

export function ensureCheckoutSchema() {
  if (!checkoutSchemaPromise) {
    checkoutSchemaPromise = (async () => {
      const statements = [
        "ALTER TABLE platform_form_runs ADD COLUMN IF NOT EXISTS lms_course_id UUID",
        "CREATE INDEX IF NOT EXISTS idx_platform_form_runs_lms_course ON platform_form_runs(lms_course_id)",
        // Per-course payment settings: the currency, the amount unit, and the
        // consent wording shown on the checkout.
        "ALTER TABLE lms_courses ADD COLUMN IF NOT EXISTS payment_currency TEXT",
        "ALTER TABLE lms_courses ADD COLUMN IF NOT EXISTS payment_amount_unit TEXT",
        "ALTER TABLE lms_courses ADD COLUMN IF NOT EXISTS payment_consent_text TEXT",
        `CREATE TABLE IF NOT EXISTS lms_registrations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          reference TEXT NOT NULL UNIQUE,
          run_id INTEGER,
          submission_id INTEGER,
          course_id UUID REFERENCES lms_courses(id) ON DELETE SET NULL,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL,
          phone TEXT,
          language TEXT NOT NULL DEFAULT 'en',
          amount NUMERIC(10,2) NOT NULL,
          provider_amount NUMERIC(10,2),
          currency TEXT NOT NULL DEFAULT 'XOF',
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
          provider TEXT,
          provider_transaction_id TEXT,
          partner_id TEXT,
          access_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (access_status IN ('pending', 'granted', 'failed', 'revoked')),
          access_error TEXT,
          email_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (email_status IN ('pending', 'sent', 'failed')),
          user_cid TEXT,
          consent_at TIMESTAMPTZ,
          paid_at TIMESTAMPTZ,
          failed_at TIMESTAMPTZ,
          refunded_at TIMESTAMPTZ,
          resume_token_hash TEXT,
          resume_token_expires_at TIMESTAMPTZ,
          browser_token_hash TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        )`,
        // The browser that CAPTURED the registration gets a one-way token in an
        // httpOnly cookie: it is the proof of ownership that lets that SAME browser
        // resume an unpaid payment directly, while a stranger who merely knows the
        // email is answered neutrally. HASH only, like the resume token.
        "ALTER TABLE lms_registrations ADD COLUMN IF NOT EXISTS browser_token_hash TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_registrations_browser_token ON lms_registrations(browser_token_hash) WHERE browser_token_hash IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_registrations_reference ON lms_registrations(reference)",
        // A refund does not decide the access: revoking it is a SEPARATE, explicit
        // act (the team refunds first, then chooses). 'revoked' is that fourth
        // access state. The constraint is re-created so a table built before this
        // state existed accepts it too.
        "ALTER TABLE lms_registrations DROP CONSTRAINT IF EXISTS lms_registrations_access_status_check",
        "ALTER TABLE lms_registrations ADD CONSTRAINT lms_registrations_access_status_check CHECK (access_status IN ('pending', 'granted', 'failed', 'revoked'))",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_registrations_course_email ON lms_registrations(course_id, email)",
        "CREATE INDEX IF NOT EXISTS idx_lms_registrations_course ON lms_registrations(course_id)",
        "CREATE INDEX IF NOT EXISTS idx_lms_registrations_run ON lms_registrations(run_id)",
        "CREATE INDEX IF NOT EXISTS idx_lms_registrations_status ON lms_registrations(status)",
        "CREATE INDEX IF NOT EXISTS idx_lms_registrations_user ON lms_registrations(user_cid)",
        "CREATE INDEX IF NOT EXISTS idx_lms_registrations_email ON lms_registrations(email)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_registrations_resume_token ON lms_registrations(resume_token_hash) WHERE resume_token_hash IS NOT NULL",
        `CREATE TABLE IF NOT EXISTS lms_payment_events (
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
        )`,
        "CREATE INDEX IF NOT EXISTS idx_lms_payment_events_registration ON lms_payment_events(registration_id)",
        "CREATE INDEX IF NOT EXISTS idx_lms_payment_events_transaction ON lms_payment_events(provider_transaction_id)",
        "CREATE INDEX IF NOT EXISTS idx_lms_payment_events_reference ON lms_payment_events(reference)",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_payment_events_unique_event ON lms_payment_events(provider, provider_transaction_id, event_type) WHERE provider_transaction_id IS NOT NULL AND event_type IS NOT NULL",
      ];

      for (const sql of statements) {
        try {
          await db.execute({ sql, args: [] });
        } catch (error) {
          console.warn("[CheckoutSchema] skipped statement:", error.message);
        }
      }
      return true;
    })().catch((error) => {
      console.warn("[CheckoutSchema] ensureCheckoutSchema failed:", error.message);
      checkoutSchemaPromise = null; // allow a retry on the next call
      return false;
    });
  }
  return checkoutSchemaPromise;
}
