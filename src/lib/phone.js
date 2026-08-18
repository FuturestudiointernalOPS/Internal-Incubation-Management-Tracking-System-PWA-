import { parsePhoneNumber, isValidPhoneNumber } from "libphonenumber-js";

/**
 * Canonical phone number helpers.
 *
 * The app stores phone numbers in E.164 format, e.g. "+2349012345678".
 * Legacy values are JSON strings like `{"country":"Nigeria","code":"+234","number":"90 84 78 20"}`.
 */

/** Convert any stored phone value to E.164, or "" when it cannot be resolved. */
export function toE164(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  // Legacy structured JSON.
  if (raw.startsWith("{")) {
    try {
      const p = JSON.parse(raw);
      const dial = String(p.code || "").replace(/\D/g, "");
      const digits = String(p.number || "").replace(/\D/g, "");
      if (!dial || !digits) return "";
      const candidate = `+${dial}${digits}`;
      const parsed = parsePhoneNumber(candidate);
      return parsed ? parsed.number : candidate;
    } catch (_) {
      return "";
    }
  }

  // Already E.164.
  if (raw.startsWith("+")) {
    const parsed = parsePhoneNumber(raw);
    return parsed ? parsed.number : raw;
  }

  // A bare national number has no country context — keep it as-is.
  return raw;
}

/** True when the value is a valid E.164 phone number. */
export function isValidPhone(value) {
  const e164 = toE164(value);
  return e164 ? isValidPhoneNumber(e164) : false;
}

/** Human-readable international format, e.g. "+234 901 234 5678". */
export function formatPhoneInternational(value) {
  const e164 = toE164(value);
  if (!e164) return value || "";
  const parsed = parsePhoneNumber(e164);
  return parsed ? parsed.formatInternational() : e164;
}

/** Resolve the ISO country of a stored E.164 number ("" when unknown). */
export function getPhoneCountry(value) {
  const e164 = toE164(value);
  if (!e164) return "";
  const parsed = parsePhoneNumber(e164);
  return parsed ? parsed.country || "" : "";
}
