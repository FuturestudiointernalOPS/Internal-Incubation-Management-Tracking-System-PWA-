/**
 * VENTURE IDENTITY — one internal identifier, one decorative code.
 *
 * A Venture has carried TWO identities since the beginning, because two
 * generations of the `ventures` table coexist (see docs/HANDOVER_VENTURES.md
 * and migrations/audit_venture_id_types.sql):
 *
 *   internal id   `ventures.id`         — canonically a UUID. The ONLY value a
 *                                         stored relationship may hold.
 *   code          `ventures.venture_id` — `VNT-XXXXXXXX`. A human-facing alias,
 *                                         used to address a Venture in a URL or
 *                                         an API path, and NOWHERE ELSE.
 *
 * The drift to fix (Vinance Phase 0) is that the code is not decorative today:
 * it is a real column, and in the older table generation it is the FOREIGN KEY
 * TARGET that child rows store. So the same relationship is written with the
 * code in some tables and with the internal id in others, and a join can only
 * cross them through an `OR` bridge (see the two `JOIN ventures v ON
 * (x.venture_id::text = v.id::text OR x.venture_id::text = v.venture_id)` sites).
 *
 * THE CONTRACT, once the storage is unified:
 *   • the code stays the KEY people and routes use — this module exists so that
 *     decision lives in one place instead of as a scattered `^VNT-` regex;
 *   • every STORED reference holds the internal id;
 *   • nothing stores the code, so nothing needs a bridge.
 *
 * Nothing here runs SQL or reads a database — this is the vocabulary the model
 * and service layers agree on. Detecting which convention a given row currently
 * holds is a data question, answered by migrations/audit_venture_identity_map.sql.
 */

/** The prefix every Venture code carries. */
export const VENTURE_CODE_PREFIX = "VNT";

/** Loose shape of a code, matching what the API has always accepted (`VNT-…`). */
export const VENTURE_CODE_REGEX = /^VNT-/i;

/**
 * Is this reference the decorative code (rather than the internal id)?
 *
 * Deliberately prefix-based, because this is the exact test the read path has
 * used since ids started being normalized (`services/ventures/record`). Tightening
 * it here would silently stop resolving a code that is stored with an unexpected
 * suffix, which is worse than being permissive.
 */
export function isVentureCode(value) {
  return typeof value === "string" && VENTURE_CODE_REGEX.test(value);
}

/**
 * Is this reference the internal id (a UUID — or, on a database that has not run
 * the conversion yet, the legacy integer)?
 *
 * "Not a code" and "not empty" is the whole test: the internal id has no
 * distinctive shape shared by both the UUID and the legacy integer form, and
 * inventing one here would refuse valid references.
 */
export function isVentureInternalId(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  if (!text) return false;
  return !isVentureCode(text);
}

/**
 * Classify a reference without touching the database: the code, the internal id,
 * or nothing usable. Callers that must branch read this and never re-derive it.
 */
export function ventureRefKind(value) {
  if (value === null || value === undefined) return "empty";
  const text = String(value).trim();
  if (!text) return "empty";
  return isVentureCode(text) ? "code" : "internal";
}
