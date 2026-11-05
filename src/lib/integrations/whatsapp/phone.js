/**
 * WhatsApp phone numbers — the E.164 rule, enforced.
 *
 * A WhatsApp message is addressed to a full international number. A local
 * number is not "almost right": it goes to the wrong person, or nowhere, and a
 * pattern of those sends is exactly what damages a sender's quality rating.
 * So a number that cannot be resolved to a valid E.164 value is refused here,
 * before any message is composed.
 *
 * The default country is configurable because the platform's users mostly
 * type a national number ("96 12 34 56"), and a deployment that guessed the
 * wrong country would produce wrong links. `WHATSAPP_DEFAULT_COUNTRY` is an
 * ISO 3166-1 alpha-2 code (default: BJ).
 */

import { getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js";

export const WHATSAPP_DEFAULT_COUNTRY =
  (process.env.WHATSAPP_DEFAULT_COUNTRY || "BJ").toUpperCase();

/** A usable ISO alpha-2 country code, or null. */
function usableCountry(countryCode) {
  const value = String(countryCode || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

function parse(value, defaultCountry) {
  try {
    return parsePhoneNumberFromString(value, defaultCountry || undefined);
  } catch (_) {
    return null;
  }
}

/**
 * Normalize a stored phone number to WhatsApp's form.
 *
 * Returns `{ e164, digits, country }` or null. `digits` is what a wa.me link
 * and the Cloud API expect (no leading `+`).
 */
export function normalizeWhatsappPhone(phone, countryCode) {
  const raw = String(phone || "").trim();
  if (!raw) return null;

  const defaultCountry = usableCountry(countryCode) || WHATSAPP_DEFAULT_COUNTRY;
  let parsed = parse(raw, defaultCountry);

  const digits = raw.replace(/\D/g, "");

  // "00 229 …" is how many people write an international number.
  if ((!parsed || !parsed.isValid()) && digits.startsWith("00") && digits.length >= 10) {
    parsed = parse("+" + digits.slice(2), defaultCountry);
  }

  // A country dial code written without the leading "+" ("229 96 12 34 56").
  if (!parsed || !parsed.isValid()) {
    try {
      const dial = getCountryCallingCode(defaultCountry);
      if (digits.startsWith(dial) && digits.length >= dial.length + 6) {
        parsed = parse("+" + digits, defaultCountry);
      }
    } catch (_) {
      // An unknown default country simply leaves the number unresolved.
    }
  }

  if (!parsed || !parsed.isValid()) return null;

  return {
    e164: parsed.number,
    digits: parsed.number.replace(/\D/g, ""),
    country: parsed.country || null,
  };
}

/**
 * The exact stored shapes a received number may match.
 *
 * A WhatsApp sender always arrives in international form. A contact may have
 * been stored internationally, locally, or with a `00` prefix. The variants are
 * compared EXACTLY (never by suffix): matching the last digits could attach an
 * inbound STOP to the wrong person.
 */
export function whatsappNumberVariants(digits) {
  const raw = String(digits || "").replace(/\D/g, "");
  if (!raw) return [];

  const variants = new Set([raw, `00${raw}`]);
  try {
    const dial = getCountryCallingCode(WHATSAPP_DEFAULT_COUNTRY);
    if (raw.startsWith(dial) && raw.length > dial.length + 6) {
      // Stored locally: "0196123456" for "2290196123456".
      variants.add(raw.slice(dial.length));
    }
  } catch (_) {
    // An unknown default country keeps the international forms only.
  }
  return [...variants];
}
