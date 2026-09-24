import crypto from "crypto";
import db from "@/lib/db";
import { LmsError } from "./errors";

/**
 * CHECKOUT REGISTRATIONS (public form run -> payment -> course access)
 *
 * Everything the checkout knows about a person BEFORE money moves, plus the
 * payment outcome attached to the SAME row. Captured first, money second, access
 * third — so an abandoned or failed payment is a follow-up opportunity instead
 * of a lost lead.
 *
 * Three INDEPENDENT states, deliberately never collapsed into one:
 *   - `status`        the money   (pending / paid / failed / cancelled / refunded)
 *   - `access_status` the course  (pending / granted / failed)
 *   - `email_status`  the receipt (pending / sent / failed)
 *
 * Invariants owned here:
 *   - one reference = one registration (generated here, never client-supplied);
 *   - one person + one course = one registration, so a retry UPDATES the row;
 *   - the amount is a SERVER-decided snapshot, never the browser's claim;
 *   - a paid registration is never silently rewritten.
 *
 * See supabase/migrations/20260924_lms_checkout_registrations.sql.
 */

const REGISTRATION_SELECT = `SELECT id, reference, run_id, submission_id, course_id, full_name, email, phone,
                                    language, amount, currency, status, provider, provider_transaction_id,
                                    partner_id, access_status, access_error, email_status, user_cid,
                                    consent_at, paid_at, failed_at, refunded_at, created_at, updated_at
                             FROM lms_registrations`;

export function paymentCurrency() {
  return String(process.env.PAYMENT_CURRENCY || "XOF").toUpperCase();
}

/**
 * HOW THE PRICE REACHES THE PROVIDER.
 *
 * A currency with no minor unit (XOF, XAF) is sent whole; one with cents is
 * usually expected in minor units. Rather than guessing, the unit is DEFINABLE:
 *
 *   PAYMENT_AMOUNT_UNIT          "major" (default) | "minor"  -> x1 | x100
 *   PAYMENT_AMOUNT_MULTIPLIER    an explicit number, when neither fits
 *
 * The registration always stores the amount the PERSON pays (whole units); the
 * conversion happens only at the two edges: what the payment window is asked
 * for, and what the provider's verification is compared against.
 */
export function paymentAmountMultiplier() {
  const explicit = Number(process.env.PAYMENT_AMOUNT_MULTIPLIER);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return String(process.env.PAYMENT_AMOUNT_UNIT || "major").toLowerCase() === "minor" ? 100 : 1;
}

/** Whole-unit price -> the amount the provider expects. */
export function toProviderAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * paymentAmountMultiplier());
}

/** The provider's amount -> the whole-unit price. */
export function fromProviderAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const multiplier = paymentAmountMultiplier();
  return multiplier === 1 ? value : value / multiplier;
}

/** Lowercased, trimmed — the canonical form stored in `email`. */
export function normalizeRegistrationEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * A stable, human-copyable, NON-PERSONAL reference. 4 random bytes = ~4 billion
 * values per year, so guessing another payer's reference is impractical.
 */
export function generateReference() {
  const year = new Date().getUTCFullYear();
  const token = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `REG-${year}-${token}`;
}

function parseRegistration(row) {
  if (!row) return null;
  return { ...row, amount: row.amount == null ? null : Number(row.amount) };
}

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
          currency TEXT NOT NULL DEFAULT 'XOF',
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
          provider TEXT,
          provider_transaction_id TEXT,
          partner_id TEXT,
          access_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (access_status IN ('pending', 'granted', 'failed')),
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
        )`,
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_lms_registrations_reference ON lms_registrations(reference)",
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

export async function getRegistrationById(id) {
  await ensureCheckoutSchema();
  const res = await db.execute({ sql: `${REGISTRATION_SELECT} WHERE id = ?`, args: [id] });
  return parseRegistration(res.rows[0]);
}

export async function getRegistrationByReference(reference) {
  await ensureCheckoutSchema();
  const value = String(reference || "").trim();
  if (!value) return null;
  const res = await db.execute({ sql: `${REGISTRATION_SELECT} WHERE reference = ?`, args: [value] });
  return parseRegistration(res.rows[0]);
}

export async function getRegistrationByTransactionId(transactionId) {
  await ensureCheckoutSchema();
  const value = String(transactionId || "").trim();
  if (!value) return null;
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE provider_transaction_id = ?`,
    args: [value],
  });
  return parseRegistration(res.rows[0]);
}

/**
 * The person + course pair. `courseId` is required: a null course would make the
 * uniqueness meaningless, so callers never ask for it.
 */
export async function findRegistrationByCourseAndEmail(courseId, email) {
  await ensureCheckoutSchema();
  const cleanEmail = normalizeRegistrationEmail(email);
  if (!courseId || !cleanEmail) return null;
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE course_id = ? AND email = ?`,
    args: [courseId, cleanEmail],
  });
  return parseRegistration(res.rows[0]);
}

export async function createRegistration({
  reference,
  runId = null,
  submissionId = null,
  courseId,
  fullName,
  email,
  phone = null,
  language = "en",
  amount,
  currency = paymentCurrency(),
  consent = false,
}) {
  await ensureCheckoutSchema();
  const cleanName = String(fullName || "").trim();
  const cleanEmail = normalizeRegistrationEmail(email);
  if (!cleanName) throw new LmsError("lms.errors.registrationNameRequired", 400);
  if (!cleanEmail) throw new LmsError("lms.errors.registrationEmailRequired", 400);

  const res = await db.execute({
    sql: `INSERT INTO lms_registrations
            (reference, run_id, submission_id, course_id, full_name, email, phone, language,
             amount, currency, status, consent_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())
          RETURNING *`,
    args: [
      reference || generateReference(),
      runId,
      submissionId,
      courseId,
      cleanName,
      cleanEmail,
      phone ? String(phone).trim().substring(0, 40) : null,
      language || "en",
      amount,
      currency,
      consent ? new Date().toISOString() : null,
    ],
  });
  return parseRegistration(res.rows[0]);
}

/**
 * Refresh the contact details of an existing registration, and re-point it at the
 * latest attempt (run + submission) so the Execution trace stays current. The
 * reference, the amount and the states are NEVER touched here.
 */
export async function updateRegistrationAttempt(
  id,
  { fullName, phone = null, language = null, runId = null, submissionId = null } = {},
) {
  return db.execute({
    sql: `UPDATE lms_registrations
          SET full_name = ?, phone = ?, language = ?, run_id = ?, submission_id = ?, updated_at = NOW()
          WHERE id = ?`,
    args: [String(fullName || "").trim(), phone, language, runId, submissionId, id],
  });
}

/** Mark the registration paid (the amount was already verified server-side). */
export async function markRegistrationPaid(id, { provider = null, transactionId = null, partnerId = null } = {}) {
  return db.execute({
    sql: `UPDATE lms_registrations
          SET status = 'paid', paid_at = NOW(), provider = ?, provider_transaction_id = ?, partner_id = ?, updated_at = NOW()
          WHERE id = ?`,
    args: [provider, transactionId, partnerId, id],
  });
}

export async function markRegistrationFailed(id, { transactionId = null, partnerId = null } = {}) {
  return db.execute({
    sql: `UPDATE lms_registrations
          SET status = 'failed', failed_at = NOW(), provider_transaction_id = ?, partner_id = ?, updated_at = NOW()
          WHERE id = ?`,
    args: [transactionId, partnerId, id],
  });
}

export async function markRegistrationCancelled(id) {
  return db.execute({
    sql: "UPDATE lms_registrations SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
    args: [id],
  });
}

export async function markRegistrationRefunded(id) {
  return db.execute({
    sql: "UPDATE lms_registrations SET status = 'refunded', refunded_at = NOW(), updated_at = NOW() WHERE id = ?",
    args: [id],
  });
}

/** The course-access step, kept SEPARATE from the money so a failure here is visible and replayable. */
export async function setAccessState(id, { status, error = null, userCid = null } = {}) {
  return db.execute({
    sql: "UPDATE lms_registrations SET access_status = ?, access_error = ?, user_cid = ?, updated_at = NOW() WHERE id = ?",
    args: [status, error, userCid, id],
  });
}

export async function setEmailState(id, { status } = {}) {
  return db.execute({
    sql: "UPDATE lms_registrations SET email_status = ?, updated_at = NOW() WHERE id = ?",
    args: [status, id],
  });
}

/**
 * Record a transaction id the BROWSER reported after the payment window closed.
 * A hint only: it helps later lookups and never grants anything.
 */
export async function setPaymentHint(id, { transactionId = null, partnerId = null } = {}) {
  return db.execute({
    sql: "UPDATE lms_registrations SET provider_transaction_id = ?, partner_id = ?, updated_at = NOW() WHERE id = ?",
    args: [transactionId, partnerId, id],
  });
}

/**
 * Append a provider notification to the journal. A repeat of the same event is
 * IGNORED, not raised: Kkiapay retries, and a 500 here would only trigger more
 * retries. Unknown references and refused amounts land here too — a refused
 * notification is never dropped silently.
 */
export async function recordPaymentEvent({
  registrationId = null,
  reference = null,
  runId = null,
  provider = null,
  eventType = "notification",
  transactionId = null,
  partnerId = null,
  amount = null,
  status = "received",
  message = null,
  payload = null,
} = {}) {
  await ensureCheckoutSchema();
  return db.execute({
    sql: `INSERT INTO lms_payment_events
            (registration_id, reference, run_id, provider, event_type, provider_transaction_id,
             partner_id, amount, status, message, payload, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON CONFLICT (provider, provider_transaction_id, event_type)
            WHERE provider_transaction_id IS NOT NULL AND event_type IS NOT NULL
          DO NOTHING`,
    args: [
      registrationId,
      reference,
      runId,
      provider,
      eventType,
      transactionId,
      partnerId,
      amount,
      status,
      message,
      payload ? JSON.stringify(payload) : null,
    ],
  });
}

/** The most recent journal line for one registration (shown in the team view). */
export async function getLatestPaymentEventByRegistrationId(registrationId) {
  const res = await db.execute({
    sql: `SELECT status, message, created_at FROM lms_payment_events
          WHERE registration_id = ? ORDER BY created_at DESC`,
    args: [registrationId],
  });
  return res.rows[0] || null;
}

/** The journal, newest intent first — including orphan lines (no registration). */
export async function listPaymentEvents({ status } = {}) {
  await ensureCheckoutSchema();
  const clauses = [];
  const args = [];
  if (status) {
    clauses.push("status = ?");
    args.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await db.execute({
    sql: `SELECT id, registration_id, reference, run_id, provider, event_type,
                 provider_transaction_id, partner_id, amount, status, message, created_at
          FROM lms_payment_events ${where} ORDER BY created_at DESC`,
    args,
  });
  return res.rows;
}

function buildRegistrationFilters({ runId, courseId, status, access, emailStatus } = {}) {
  const clauses = [];
  const args = [];
  if (runId) {
    clauses.push("run_id = ?");
    args.push(runId);
  }
  if (courseId) {
    clauses.push("course_id = ?");
    args.push(courseId);
  }
  if (status) {
    clauses.push("status = ?");
    args.push(status);
  }
  if (access) {
    clauses.push("access_status = ?");
    args.push(access);
  }
  if (emailStatus) {
    clauses.push("email_status = ?");
    args.push(emailStatus);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", args };
}

/** Team view: registrations, optionally filtered by Execution / course / states. */
export async function listRegistrations(filters = {}) {
  await ensureCheckoutSchema();
  const { where, args } = buildRegistrationFilters(filters);
  const limit = Number(filters.limit);
  const offset = Number(filters.offset);
  let tail = " ORDER BY created_at DESC";
  if (Number.isFinite(limit) && limit > 0) {
    tail += " LIMIT ?";
    args.push(limit);
  }
  if (Number.isFinite(offset) && offset > 0) {
    tail += " OFFSET ?";
    args.push(offset);
  }
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} ${where}${tail}`,
    args,
  });
  return res.rows.map(parseRegistration);
}

/**
 * The Executions that actually have registrations — used to POPULATE the team
 * view's filter (a bounded derivation, not a counter; the header counters are
 * aggregated in the database by getRegistrationStats).
 */
export async function listRegistrationsRunOptions() {
  const res = await db.execute({
    sql: "SELECT run_id, course_id, status FROM lms_registrations",
    args: [],
  });
  const byRun = new Map();
  for (const row of res.rows) {
    const key = String(row.run_id ?? "none");
    const entry = byRun.get(key) || { run_id: row.run_id ?? null, course_id: row.course_id ?? null, total: 0, paid: 0 };
    entry.total += 1;
    if (row.status === "paid") entry.paid += 1;
    byRun.set(key, entry);
  }
  return [...byRun.values()];
}

/**
 * The newest journal line of each registration in the list — ONE query, so the
 * team view never runs per-row lookups.
 */
export async function listPaymentEventsByRegistrationIds(ids) {
  const list = [...new Set((ids || []).map((id) => String(id)).filter(Boolean))];
  if (list.length === 0) return [];
  const res = await db.execute({
    sql: `SELECT registration_id, status, message, created_at FROM lms_payment_events
          WHERE registration_id IN (${list.map(() => "?").join(",")})
          ORDER BY created_at DESC`,
    args: list,
  });
  return res.rows;
}

export async function countRegistrations(filters = {}) {
  await ensureCheckoutSchema();
  const { where, args } = buildRegistrationFilters(filters);
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM lms_registrations ${where}`,
    args,
  });
  return Number(res.rows[0]?.n || 0);
}

/** Every registration captured for one email, newest first (resend / resume). */
export async function listRegistrationsByEmail(email) {
  const cleanEmail = normalizeRegistrationEmail(email);
  if (!cleanEmail) return [];
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE email = ? ORDER BY created_at DESC`,
    args: [cleanEmail],
  });
  return res.rows.map(parseRegistration);
}

/** Store a new "come back and finish" token HASH (the raw token is only emailed). */
export async function setResumeToken(id, { tokenHash, expiresAt }) {
  return db.execute({
    sql: "UPDATE lms_registrations SET resume_token_hash = ?, resume_token_expires_at = ?, updated_at = NOW() WHERE id = ?",
    args: [tokenHash, expiresAt, id],
  });
}

export async function getRegistrationByResumeTokenHash(tokenHash) {
  if (!tokenHash) return null;
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE resume_token_hash = ?`,
    args: [tokenHash],
  });
  return parseRegistration(res.rows[0]);
}

/** Consume a resume token: a link that was already used must never work twice. */
export async function clearResumeToken(id) {
  return db.execute({
    sql: "UPDATE lms_registrations SET resume_token_hash = NULL, resume_token_expires_at = NULL, updated_at = NOW() WHERE id = ?",
    args: [id],
  });
}

/**
 * "À examiner" queue: registrations that need a human — a confirmed payment whose
 * access step failed, or a payment that failed. Two DB-filtered reads, merged
 * (failures are rare, so the set stays small), never a scan of every row.
 */
export async function listRegistrationsToReview(filters = {}) {
  const [accessFailed, paymentFailed] = await Promise.all([
    listRegistrations({ ...filters, access: "failed" }),
    listRegistrations({ ...filters, status: "failed" }),
  ]);
  const seen = new Set();
  const merged = [];
  for (const row of [...accessFailed, ...paymentFailed]) {
    const key = String(row.id);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged;
}

/**
 * Counters, aggregated IN THE DATABASE (one count per state) so the team view
 * never loads every row to count them.
 */
export async function getRegistrationStats(filters = {}) {
  const { runId, courseId } = filters;
  const base = { runId, courseId };
  const [
    total,
    paid,
    pending,
    failed,
    cancelled,
    refunded,
    accessGranted,
    accessFailed,
    emailSent,
    emailFailed,
  ] = await Promise.all([
    countRegistrations(base),
    countRegistrations({ ...base, status: "paid" }),
    countRegistrations({ ...base, status: "pending" }),
    countRegistrations({ ...base, status: "failed" }),
    countRegistrations({ ...base, status: "cancelled" }),
    countRegistrations({ ...base, status: "refunded" }),
    countRegistrations({ ...base, access: "granted" }),
    countRegistrations({ ...base, access: "failed" }),
    countRegistrations({ ...base, emailStatus: "sent" }),
    countRegistrations({ ...base, emailStatus: "failed" }),
  ]);

  return {
    total,
    registered: total,
    paid,
    pending,
    failed,
    cancelled,
    refunded,
    accessGranted,
    accessFailed,
    emailSent,
    emailFailed,
  };
}

/**
 * Registrations that a confirmed payment is attached to but whose access was
 * never granted — the reconciliation sweep retries the VERIFICATION for those
 * that were never verified, and the ACCESS step for those already paid.
 */
export async function listPaidRegistrationsNeedingAccess() {
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE status = 'paid' AND access_status = ? ORDER BY paid_at DESC`,
    args: ["failed"],
  });
  return res.rows.map(parseRegistration);
}

/** Paid registrations whose access is still pending (claimed success, not yet closed). */
export async function listPaidRegistrationsPendingAccess() {
  const res = await db.execute({
    sql: `${REGISTRATION_SELECT} WHERE status = 'paid' AND access_status = ? ORDER BY paid_at DESC`,
    args: ["pending"],
  });
  return res.rows.map(parseRegistration);
}
