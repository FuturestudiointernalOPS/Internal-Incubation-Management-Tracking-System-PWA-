/**
 * WhatsApp contactability — the single decision before any message.
 *
 * Three independent conditions, all required:
 *   1. the person has explicitly agreed (opt-in),
 *   2. the record is live (not archived, not deleted),
 *   3. the phone number resolves to a valid E.164 value.
 *
 * Keeping the rule in one pure function means the CRM button, the future
 * automated sender and the tests cannot drift apart: a screen may not decide
 * on its own that someone is contactable.
 */

import { normalizeWhatsappPhone } from "./phone";

export const WHATSAPP_REASONS = Object.freeze({
  OK: "ok",
  NO_CONTACT: "no_contact",
  INACTIVE: "inactive",
  NO_CONSENT: "no_consent",
  INVALID_PHONE: "invalid_phone",
});

/** Whether the stored consent flag says yes. Accepts the DB's 0/1 and booleans. */
export function isWhatsappOptedIn(contact) {
  if (!contact) return false;
  const value = contact.whatsapp_opt_in ?? contact.whatsappOptIn;
  return value === true || value === 1 || value === "1";
}

function isInactive(contact) {
  if (!contact) return true;
  if (contact.deleted === true || contact.deleted === 1 || contact.deleted === "1") return true;
  return Boolean(contact.deleted_at || contact.archived_at);
}

/**
 * Decide whether this contact may receive a WhatsApp message.
 *
 * Returns `{ allowed, reason, phone? }` where `phone` is the normalized
 * `{ e164, digits, country }` when allowed. The order of the checks is the
 * order in which the UI should explain a refusal.
 */
export function evaluateWhatsappReachability(contact) {
  if (!contact) return { allowed: false, reason: WHATSAPP_REASONS.NO_CONTACT };
  if (isInactive(contact)) return { allowed: false, reason: WHATSAPP_REASONS.INACTIVE };
  if (!isWhatsappOptedIn(contact)) return { allowed: false, reason: WHATSAPP_REASONS.NO_CONSENT };

  const phone = normalizeWhatsappPhone(contact.phone, contact.country_code);
  if (!phone) return { allowed: false, reason: WHATSAPP_REASONS.INVALID_PHONE };

  return { allowed: true, reason: WHATSAPP_REASONS.OK, phone };
}
