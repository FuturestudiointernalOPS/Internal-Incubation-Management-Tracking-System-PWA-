/**
 * VENTURE COMPANY STATUS — the lifecycle of the COMPANY, in one place.
 *
 * `ventures.status` has always held a company state, but nothing ever said
 * WHICH states are legal: the admin list knew `active | pending | archived`,
 * the founder screen rendered `active | paused | graduated`, and the original
 * DDL commented `active | paused | graduated | archived`. Three vocabularies for
 * one column. This module is the single source of truth the surfaces read.
 *
 * Distinct from `ventureStatuses.js`, which governs the WORK (Journey stages,
 * milestones, tasks, submissions). This one governs the COMPANY itself — the
 * field a person edits on the Venture profile.
 *
 * Stored values are NEVER rewritten here, exactly like `ventureStatuses.js`:
 * a legacy value is tolerated and mapped for DISPLAY, so a row written before
 * this vocabulary existed keeps reading correctly instead of showing a raw
 * string. Re-writing stored values is a migration's job, not a read layer's.
 */

/** The legal company states, in lifecycle order. */
export const VENTURE_COMPANY_STATUSES = [
  "prospect",
  "active",
  "paused",
  "graduated",
  "archived",
];

/** What a Venture is when nothing else is set — matches the column default. */
export const VENTURE_COMPANY_STATUS_DEFAULT = "active";

/**
 * States a database may still hold but that are no longer written, mapped to
 * the state they now mean. `pending` was the admin list's word for a Venture
 * recorded but not yet started — which is exactly a `prospect`.
 */
export const LEGACY_COMPANY_STATUSES = {
  pending: "prospect",
};

/** Company state → the i18n key that labels it (the shared `status.*` word). */
const COMPANY_STATUS_KEYS = {
  prospect: "status.prospect",
  active: "status.active",
  paused: "status.paused",
  graduated: "status.graduated",
  archived: "status.archived",
};

/**
 * Canonicalize a stored value: lowercase, trimmed, legacy-mapped. Returns null
 * when there is nothing usable, so a caller can fall back explicitly instead of
 * receiving a silently wrong state.
 */
export function normalizeCompanyStatus(stored) {
  const text = String(stored ?? "").trim().toLowerCase();
  if (!text) return null;
  if (Object.prototype.hasOwnProperty.call(LEGACY_COMPANY_STATUSES, text)) {
    return LEGACY_COMPANY_STATUSES[text];
  }
  return VENTURE_COMPANY_STATUSES.includes(text) ? text : null;
}

/**
 * { id, key, tone, raw } for a stored value. An UNKNOWN value is never guessed:
 * it is returned as itself (`raw`) so a gap shows up in the UI as what is
 * really stored, rather than as a confidently wrong word.
 */
export function companyStatusWord(stored) {
  const canonical = normalizeCompanyStatus(stored);
  if (!canonical) {
    const text = String(stored ?? "").trim();
    return { id: "unknown", key: null, tone: "unknown", raw: text || null };
  }
  return { id: canonical, key: COMPANY_STATUS_KEYS[canonical], tone: canonical, raw: null };
}

/**
 * The translated label for a stored value, or — when there is no word yet — the
 * raw stored value, never a bare i18n key.
 */
export function companyStatusLabel(stored, t) {
  const word = companyStatusWord(stored);
  if (word.key && typeof t === "function") {
    const translated = t(word.key);
    if (translated && translated !== word.key) return translated;
  }
  return word.raw || (word.id !== "unknown" ? word.id.replace(/_/g, " ") : "");
}

/** The options an editor renders, in lifecycle order, already labelled. */
export function companyStatusOptions(t) {
  return VENTURE_COMPANY_STATUSES.map((value) => ({
    value,
    label: companyStatusLabel(value, t),
  }));
}
