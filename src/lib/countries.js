import { getCountries, getCountryCallingCode } from "libphonenumber-js";

/**
 * Standardized country list, derived from libphonenumber-js metadata.
 *
 * - `iso`  : ISO 3166-1 alpha-2 code (the stable value we store in the DB)
 * - `dial` : international dial prefix (E.164 calling code)
 * - `flag` : emoji flag (computed from the ISO code)
 * - `name` : localized country name (resolved with Intl.DisplayNames)
 */

const nameCache = new Map();

function localizedName(iso, locale) {
  const key = `${locale}:${iso}`;
  if (!nameCache.has(key)) {
    try {
      nameCache.set(
        key,
        new Intl.DisplayNames([locale], { type: "region" }).of(iso) || iso,
      );
    } catch (_) {
      nameCache.set(key, iso);
    }
  }
  return nameCache.get(key);
}

function isoToFlag(iso) {
  return iso
    .toUpperCase()
    .replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}

let cachedCountries = null;

/**
 * Returns [{ iso, dial, flag, nameEn, nameFr }, ...] for all countries that have
 * a calling code. The result is memoized; it is static per process.
 */
export function getCountryOptions() {
  if (cachedCountries) return cachedCountries;

  cachedCountries = getCountries()
    .map((iso) => {
      let dial = "";
      try {
        dial = `+${getCountryCallingCode(iso)}`;
      } catch (_) {
        dial = "";
      }
      return {
        iso,
        dial,
        flag: isoToFlag(iso),
        nameEn: localizedName(iso, "en"),
        nameFr: localizedName(iso, "fr"),
      };
    })
    .filter((c) => c.dial);

  // Common countries first for a nicer default ordering.
  const priority = new Set(["BJ", "NG", "GH", "KE", "ZA", "EG", "FR", "GB", "US", "CA"]);
  cachedCountries.sort((a, b) => {
    const pa = priority.has(a.iso) ? 0 : 1;
    const pb = priority.has(b.iso) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.nameEn.localeCompare(b.nameEn);
  });

  return cachedCountries;
}

/** Resolve a country name (localized) from an ISO code. */
export function getCountryName(iso, locale = "en") {
  if (!iso) return "";
  return localizedName(iso, locale);
}

/** Resolve a dial code from an ISO code. */
export function getCountryDial(iso) {
  if (!iso) return "";
  try {
    return `+${getCountryCallingCode(iso)}`;
  } catch (_) {
    return "";
  }
}

/** Resolve the flag emoji from an ISO code. */
export function getCountryFlag(iso) {
  return iso ? isoToFlag(iso) : "";
}
