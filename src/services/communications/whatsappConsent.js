/**
 * WhatsApp consent — the use-case and its rules.
 *
 * Consent is granted by the person, from a surface where they are themselves
 * identifiable: their own registration form or their own profile. It is NOT
 * granted from a bulk import, a CRM edit, or an anonymous form claiming
 * somebody else's email — those can only ever WITHDRAW nothing and GRANT
 * nothing, because a consent nobody can prove is worse than no consent.
 *
 * The reads/writes go through `@/models/contacts/whatsapp`; nothing here runs
 * SQL. See docs/LAYER_SPLIT.md.
 */

import {
  getContactWhatsappFields,
  getWhatsappConsent,
  upsertWhatsappConsent,
} from "@/models/contacts/whatsapp";
import { isWhatsappOptedIn } from "@/lib/integrations/whatsapp/rules";
import { normalizeWhatsappPhone } from "@/lib/integrations/whatsapp/phone";

/** Where a consent was captured. Stored verbatim, for the audit trail. */
export const WHATSAPP_CONSENT_SOURCES = Object.freeze({
  PARTICIPANT_REGISTRATION: "registration:participant",
  STAFF_REGISTRATION: "registration:staff",
  LMS_REGISTRATION: "registration:lms",
  PROFILE: "profile",
  STOP: "whatsapp:stop",
});

/** The current consent of one contact, with safe defaults. */
export async function readWhatsappConsent(cid) {
  if (!cid) return { opted_in: false, source: null, opted_in_at: null, opted_out_at: null };
  const result = await getWhatsappConsent(cid);
  const row = result.rows?.[0] || null;
  return {
    opted_in: isWhatsappOptedIn({ whatsapp_opt_in: row?.opt_in }),
    source: row?.source || null,
    opted_in_at: row?.opted_in_at || null,
    opted_out_at: row?.opted_out_at || null,
  };
}

/**
 * Record the person's choice.
 *
 * Opting IN is refused when the number cannot be resolved: consent to receive
 * messages on a number we cannot identify is not actionable, and storing it
 * would let a later send fail silently. Opting OUT always succeeds — a person
 * must always be able to say stop.
 *
 * Returns `{ ok: true, opted_in }` or `{ ok: false, reason }`.
 */
export async function setWhatsappConsent({
  cid,
  accepted,
  source,
  phone,
  countryCode,
}) {
  if (!cid) return { ok: false, reason: "missing_contact" };

  if (!accepted) {
    await upsertWhatsappConsent(cid, false, source || null);
    return { ok: true, opted_in: false };
  }

  let usablePhone = phone;
  let usableCountry = countryCode;

  if (!normalizeWhatsappPhone(usablePhone, usableCountry)) {
    const stored = await getContactWhatsappFields(cid);
    const row = stored.rows?.[0] || null;
    usablePhone = row?.phone ?? usablePhone;
    usableCountry = row?.country_code ?? usableCountry;
  }

  if (!normalizeWhatsappPhone(usablePhone, usableCountry)) {
    return { ok: false, reason: "phone_required" };
  }

  await upsertWhatsappConsent(cid, true, source || null);
  return { ok: true, opted_in: true };
}

/**
 * Withdraw consent without a session — used by an inbound "STOP" once the
 * webhook exists. Kept here so the rule has one home.
 */
export async function withdrawWhatsappConsent(cid, source) {
  return setWhatsappConsent({ cid, accepted: false, source });
}
