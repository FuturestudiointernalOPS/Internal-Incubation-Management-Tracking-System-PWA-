import crypto from "crypto";

/**
 * CHECKOUT REGISTRATIONS — pure helpers and the shared row projection.
 *
 * The value helpers (currency, amount units, email normalisation, reference
 * generation, row parsing) split verbatim out of `models/lms/registrations.js`.
 * No database access here — see docs/LAYER_SPLIT.md.
 */

export const REGISTRATION_SELECT = `SELECT id, reference, run_id, submission_id, course_id, full_name, email, phone,
                                    language, amount, provider_amount, currency, status, provider, provider_transaction_id,
                                    partner_id, access_status, access_error, email_status, user_cid,
                                    consent_at, paid_at, failed_at, refunded_at,
                                    resume_token_hash, resume_token_expires_at, browser_token_hash,
                                    created_at, updated_at
                             FROM lms_registrations`;

export function paymentCurrency() {
  return String(process.env.PAYMENT_CURRENCY || "XOF").toUpperCase();
}

/**
 * HOW THE PRICE REACHES THE PROVIDER.
 *
 * A currency with no minor unit (XOF, XAF) is sent whole; one with cents is
 * usually expected in minor units. Rather than guessing, the unit is DEFINABLE —
 * per course first, then by the environment:
 *
 *   lms_courses.payment_amount_unit   'major' | 'minor'      -> x1 | x100
 *   PAYMENT_AMOUNT_UNIT               'major' (default) | 'minor'
 *   PAYMENT_AMOUNT_MULTIPLIER         an explicit number, when neither fits
 *
 * The registration always stores the amount the PERSON pays (whole units); the
 * conversion happens only at the two edges: what the payment window is asked
 * for, and what the provider's verification is compared against.
 */
export function paymentAmountMultiplier(unit = null) {
  const resolved = String(unit || "").trim().toLowerCase();
  if (resolved === "major") return 1;
  if (resolved === "minor") return 100;

  const explicit = Number(process.env.PAYMENT_AMOUNT_MULTIPLIER);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return String(process.env.PAYMENT_AMOUNT_UNIT || "major").toLowerCase() === "minor" ? 100 : 1;
}

/** Whole-unit price -> the amount the provider expects. */
export function toProviderAmount(amount, unit = null) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * paymentAmountMultiplier(unit));
}

/** The provider's amount -> the whole-unit price. */
export function fromProviderAmount(amount, unit = null) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return null;
  const multiplier = paymentAmountMultiplier(unit);
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

/** Normalise a stored row's numeric columns (internal to the split). */
export function parseRegistration(row) {
  if (!row) return null;
  return {
    ...row,
    amount: row.amount == null ? null : Number(row.amount),
    provider_amount: row.provider_amount == null ? null : Number(row.provider_amount),
  };
}

/**
 * The amount that was actually handed to the payment provider for this
 * registration (the whole-unit price scaled by the unit in force at capture
 * time). Rows written before the column existed fall back to a fresh
 * conversion, so the comparison never silently mismatches.
 */
export function providerAmountOf(registration) {
  if (!registration) return null;
  if (registration.provider_amount != null) return Number(registration.provider_amount);
  return toProviderAmount(registration.amount);
}
