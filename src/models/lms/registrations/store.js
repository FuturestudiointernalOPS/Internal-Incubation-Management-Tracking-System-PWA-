import db from "@/lib/db";
import { LmsError } from "../errors";

import { ensureCheckoutSchema } from "./schema";
import {
  REGISTRATION_SELECT,
  parseRegistration,
  normalizeRegistrationEmail,
  generateReference,
  toProviderAmount,
  paymentCurrency,
} from "./helpers";

/**
 * CHECKOUT REGISTRATIONS — the core reads, the create and the state writes.
 *
 * Split verbatim out of `models/lms/registrations.js` — see docs/LAYER_SPLIT.md.
 */

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
  providerAmount = null,
}) {
  await ensureCheckoutSchema();
  const cleanName = String(fullName || "").trim();
  const cleanEmail = normalizeRegistrationEmail(email);
  if (!cleanName) throw new LmsError("lms.errors.registrationNameRequired", 400);
  if (!cleanEmail) throw new LmsError("lms.errors.registrationEmailRequired", 400);

  const res = await db.execute({
    sql: `INSERT INTO lms_registrations
            (reference, run_id, submission_id, course_id, full_name, email, phone, language,
             amount, provider_amount, currency, status, consent_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())
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
      providerAmount == null ? toProviderAmount(amount) : providerAmount,
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

/**
 * A NEW attempt on an UNPAID registration. A 'failed' row would otherwise be read
 * as a finished failure by the payer's own tab and stop its wait, so the retry
 * puts it back to 'pending'. The stale transaction hint of the previous attempt
 * is cleared so a fresh one can be recorded. A PAID registration is never reset.
 */
export async function resetRegistrationForRetry(id) {
  return db.execute({
    sql: "UPDATE lms_registrations SET status = 'pending', provider_transaction_id = NULL, updated_at = NOW() WHERE id = ?",
    args: [id],
  });
}

/**
 * Record (or clear) the HASH of the cookie token for the browser that captured
 * this registration. The raw token is never stored — only its hash.
 */
export async function setBrowserToken(id, { tokenHash = null } = {}) {
  return db.execute({
    sql: "UPDATE lms_registrations SET browser_token_hash = ?, updated_at = NOW() WHERE id = ?",
    args: [tokenHash, id],
  });
}

/**
 * Whether the presented cookie token is the one this registration was captured
 * with. A missing token, a missing hash, or a mismatch all answer false.
 */
export function matchesBrowserToken(registration, tokenHash) {
  if (!registration?.browser_token_hash || !tokenHash) return false;
  return String(registration.browser_token_hash) === String(tokenHash);
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

/**
 * The team removed the course access of a REFUNDED registration. Distinct from a
 * technical failure ('failed'): the access existed and was deliberately taken
 * back, and the enrollment behind it is suspended (see revokePurchaseAccess).
 */
export async function markRegistrationAccessRevoked(id) {
  return db.execute({
    sql: "UPDATE lms_registrations SET access_status = 'revoked', updated_at = NOW() WHERE id = ?",
    args: [id],
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
