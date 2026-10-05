/**
 * PROFILE ASSIGNMENTS — decisions (SERVICE layer).
 *
 * Phase C of docs/ROADMAP_ROLES_PROFILES_ACCESS.md. The registry answers "which
 * profiles did this person hold, over which periods, in which context, and from
 * what source?". This module holds the RULES the registry obeys; the SQL lives
 * in `@/models/authorization/profileAssignmentsStore`.
 *
 * Three rules, each load-bearing:
 *   - ONE PERIOD = ONE RECORD. A reactivation after a close writes a NEW row; an
 *     existing period is never rewritten. That is what makes the history
 *     readable and reversible.
 *   - DATES ARE NORMALISED, and an end before a start is refused — a malformed
 *     period must never enter the registry.
 *   - THE REGISTRY DESCRIBES, IT DOES NOT DECIDE. Nothing here grants or removes
 *     access; the phases that consume it (D, E, F) own that.
 *
 * Pure except for reading the catalogue definition to check a profile's context.
 * Imports NOTHING from the database.
 */

import {
  PROFILE_CONTEXTS,
  getProfileDefinition,
  isValidProfileKey,
} from "@/models/authorization/profile-catalog";

export const ASSIGNMENT_STATUSES = ["active", "ended", "revoked"];
export const ASSIGNMENT_SOURCES = ["manual", "automatic"];

/** The close action a PATCH may ask for → the status it writes. */
export const CLOSE_ACTIONS = { close: "ended", revoke: "revoked" };

/**
 * A relation type → the CONTEXT an assignment derived from it belongs to. The
 * registry only needs the context (the profile KEY is supplied by the caller):
 * a founder relationship lives in the venture context, a facilitator in the
 * program context, and so on.
 */
export const RELATIONSHIP_CONTEXTS = {
  venture_founder: "venture",
  venture_team_member: "venture",
  venture_manager: "venture",
  program_facilitator: "program",
  program_manager: "program",
  investor: "investor",
  lms_learner: "lms",
};

/**
 * Relation → the source/context an automatic assignment records. Returns null
 * for a relation this build does not map, so a caller reports the gap rather
 * than writing a record with no context.
 *
 * @param {{type?: string, contextId?: string|null}|null|undefined} relationship
 * @returns {{source: "automatic", contextType: string, contextId: string|null}|null}
 */
export function deriveAssignmentSource(relationship) {
  if (!relationship || typeof relationship !== "object") return null;
  const contextType = RELATIONSHIP_CONTEXTS[String(relationship.type || "")];
  if (!contextType) return null;
  return {
    source: "automatic",
    contextType,
    contextId:
      relationship.contextId === undefined || relationship.contextId === null
        ? null
        : String(relationship.contextId),
  };
}

/**
 * Normalise a date to a full ISO string.
 *
 * @returns {{ok: true, value: string|null} | {ok: false, value: null}}
 *   `value` is null for an absent date (no end = open period); `ok: false`
 *   only for a value that is present but unparseable.
 */
export function normalizeAssignmentDate(value) {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return { ok: false, value: null };
  return { ok: true, value: date.toISOString() };
}

/**
 * Is this row a CURRENT assignment? Active status AND not past its end date.
 * A row with no end is open-ended. (An expired row is excluded here even before
 * a sweep closes it, so a stale row never reads as live.)
 *
 * @param {{status?: string, ends_at?: unknown}|null|undefined} row
 * @param {string} [nowIso]
 */
export function isAssignmentActive(row, nowIso = new Date().toISOString()) {
  if (!row || String(row.status) !== "active") return false;
  if (row.ends_at === undefined || row.ends_at === null) return true;
  const end = normalizeAssignmentDate(row.ends_at);
  if (!end.ok || end.value === null) return true; // unparseable end reads as open
  return end.value > nowIso;
}

/**
 * Validate + normalise one MANUAL assignment request.
 *
 * @param {object} input
 * @param {string} input.cid  the person (accepted as `cid` or `contact_cid`)
 * @param {string} input.profile_key  a catalogue key
 * @param {string} [input.context_type]  defaults to the profile's own context
 * @param {string} [input.context_id]
 * @param {string|Date} [input.started_at]
 * @param {string|Date} [input.ends_at]
 * @param {string} [input.source]  "manual" (default) | "automatic"
 * @returns {{valid: boolean, errors: string[], normalized: object}}
 */
export function validateProfileAssignment(input = {}) {
  const errors = [];

  const contactCid = String(input.cid ?? input.contact_cid ?? "").trim();
  if (!contactCid) errors.push("cid is required");

  const profileKey = String(input.profile_key ?? input.profileKey ?? "");
  if (!isValidProfileKey(profileKey)) errors.push(`unknown profile: ${profileKey}`);

  const definition = getProfileDefinition(profileKey);
  // The context defaults to the profile's own context; a caller that supplies
  // one must supply the matching one — a founder is never a program context.
  const contextType = String(
    input.context_type ?? input.contextType ?? definition?.context ?? "",
  );
  if (!PROFILE_CONTEXTS.includes(contextType)) {
    errors.push(`unknown context: ${contextType}`);
  } else if (definition && definition.context !== contextType) {
    errors.push(`context "${contextType}" does not match profile "${profileKey}"`);
  }

  const contextId =
    input.context_id ?? input.contextId ?? null;

  const started = normalizeAssignmentDate(input.started_at ?? input.startedAt);
  if (!started.ok) errors.push("invalid started_at");
  const ends = normalizeAssignmentDate(input.ends_at ?? input.endsAt);
  if (!ends.ok) errors.push("invalid ends_at");
  if (started.ok && ends.ok && started.value && ends.value && ends.value < started.value) {
    errors.push("ends_at must be at or after started_at");
  }

  const source = String(input.source ?? "manual");
  if (!ASSIGNMENT_SOURCES.includes(source)) errors.push(`unknown source: ${source}`);

  const notes = typeof input.notes === "string" ? input.notes.slice(0, 500) : "";

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      contactCid,
      profileKey,
      contextType,
      contextId: contextId === null || contextId === undefined ? null : String(contextId),
      startedAt: started.value,
      endsAt: ends.value,
      source,
      notes,
    },
  };
}
