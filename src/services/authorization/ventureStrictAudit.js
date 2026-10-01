/**
 * VENTURE STRICT-MODE READINESS AUDIT (SERVICE layer).
 *
 * `src/app/api/engineering/permissions/venture-strict-audit/route.js` clamped
 * the limit, grouped ventures per person, built a synthetic session per
 * person, ran two per-person probes and assembled the report. Those decisions
 * move here.
 *
 * `summarizeVentureStrictAudit` moves too: it is a PURE aggregation and the
 * layering rule (`docs/LAYER_SPLIT.md`, AGENTS.md §5) says models hold data
 * access only, no decisions. `src/models/authorization/ventureScopeAudit.js`
 * keeps the two SQL reads and no longer re-exports it, so the model no longer
 * holds a decision.
 *
 * Rules, unchanged:
 *   - The limit clamps the number of PEOPLE evaluated, never the number of
 *     relationships read: the relationships count in the report stays
 *     uncapped, so a capped audit still tells you it did not look at
 *     everything.
 *   - Ventures are grouped per person in FIRST-SEEN order, so the cap keeps
 *     the people an administrator recognises first.
 *   - A person reachable through both venture tables yields one row per
 *     relationship: `ventures` is a row count, not a distinct-venture count.
 *     Pinned, not fixed — changing it would change the reported number.
 *   - BOTH probes fail closed. An unresolvable person is reported as missing
 *     `ventures.view`, a failing scope resolution as 0. Neither failure is
 *     surfaced as an error: the whole point of the audit is to answer "who
 *     would be refused", and a probe that blew up means "refused".
 *   - A super admin short-circuits: `authorize()` is never consulted.
 *   - `missing` reports the FIRST missing key only. Reading is the
 *     prerequisite, so a person who cannot read is not also told they cannot
 *     edit.
 *   - A missing contact row does not drop the person: they get a session of
 *     nulls and are still reported.
 */

import { authorize, getAuthorizationContext } from "./context";
import { resolveScopeIds } from "./scope";

/** Nobody is evaluated by default; the audit stays a quick, safe read. */
export const DEFAULT_AUDIT_LIMIT = 300;
/** The hard ceiling on `?limit`, so the audit cannot be turned into a scan. */
export const MAX_AUDIT_LIMIT = 1000;

/**
 * Clamps `?limit` into [1, MAX_AUDIT_LIMIT].
 *
 * A missing, zero or non-numeric value falls back to DEFAULT_AUDIT_LIMIT —
 * note `0` falls back rather than clamping to 1, because the falsy value never
 * reaches the clamp. Asking for 0 people evaluates 300. Pinned, not fixed:
 * changing it would change which people the audit reports.
 *
 * @param {string|null} raw
 * @returns {number}
 */
export function resolveAuditLimit(raw) {
  return Math.min(Math.max(Number(raw) || DEFAULT_AUDIT_LIMIT, 1), MAX_AUDIT_LIMIT);
}

/**
 * Groups the (person, venture) relationships into one entry per person, in
 * first-seen order, with both sides coerced to strings.
 *
 * @param {Array<{cid: *, venture_id: *}>} relationships
 * @returns {Map<string, string[]>} cid → venture ids
 */
export function groupVenturesByCid(relationships) {
  const venturesByCid = new Map();
  for (const relationship of relationships || []) {
    const cid = String(relationship.cid);
    if (!venturesByCid.has(cid)) venturesByCid.set(cid, []);
    venturesByCid.get(cid).push(String(relationship.venture_id));
  }
  return venturesByCid;
}

/**
 * The people to evaluate: the distinct cids, capped. `?limit` bounds PEOPLE,
 * not relationships.
 *
 * @param {Map<string, string[]>} venturesByCid
 * @param {number} limit
 * @returns {string[]}
 */
export function selectAuditedCids(venturesByCid, limit) {
  return [...venturesByCid.keys()].slice(0, limit);
}

/**
 * The synthetic session the resolver is probed with.
 *
 * A person with no contact row still gets one — the audit is about people
 * attached to ventures, so a missing contact is reported, not dropped.
 *
 * @param {string} cid
 * @param {{role?: string, email?: string, name?: string}|null} contact
 * @returns {{cid: string, role: string|null, email: string|null, name: string|null}}
 */
export function buildSyntheticSession(cid, contact) {
  return {
    cid,
    role: contact?.role || null,
    email: contact?.email || null,
    name: contact?.name || null,
  };
}

/**
 * Would the canonical gate admit this person? Fails CLOSED.
 *
 * An unresolvable context or a throwing `authorize()` means "refused" — which
 * is exactly the answer the audit exists to surface, so the error is swallowed
 * rather than turned into a 500.
 *
 * @param {{cid: string, role: string|null, email: string|null, name: string|null}} sessionLike
 * @returns {Promise<{viewAllowed: boolean, editAllowed: boolean}>}
 */
export async function probeVentureGate(sessionLike) {
  try {
    const authorizationContext = await getAuthorizationContext(sessionLike);
    // A super admin short-circuits: authorize() is never consulted.
    const isSuperAdmin = authorizationContext?.isSuperAdmin;
    return {
      viewAllowed: isSuperAdmin || authorize(authorizationContext, "ventures", "view"),
      editAllowed: isSuperAdmin || authorize(authorizationContext, "ventures", "edit"),
    };
  } catch {
    return { viewAllowed: false, editAllowed: false };
  }
}

/**
 * How many venture ids this person actually holds under the scope policy.
 * Fails CLOSED to 0.
 *
 * @param {string} cid
 * @param {string|null} email
 * @returns {Promise<number>}
 */
export async function countVentureScope(cid, email) {
  try {
    const resolvedScopeIds = await resolveScopeIds("venture_own", cid, { email });
    return Array.isArray(resolvedScopeIds) ? resolvedScopeIds.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Evaluates one person: synthetic session, gate probe, scope probe.
 *
 * @param {string} cid
 * @param {object|null} contact
 * @param {string[]} ventures
 * @returns {Promise<object>} the person row consumed by summarizeVentureStrictAudit
 */
export async function auditPerson(cid, contact, ventures) {
  const sessionLike = buildSyntheticSession(cid, contact);
  const { viewAllowed, editAllowed } = await probeVentureGate(sessionLike);
  const scopeCount = await countVentureScope(cid, sessionLike.email);
  return {
    cid,
    name: sessionLike.name,
    role: sessionLike.role,
    ventures,
    viewAllowed,
    editAllowed,
    scopeCount,
  };
}

/**
 * Pure aggregation of the audit rows.
 *
 * `missing` reports the FIRST missing key only: reading is the prerequisite, so
 * a person who cannot read is not also told they cannot edit.
 *
 * @param {Array<{cid: string, name?: string, role?: string, ventures: Array<string>,
 *                viewAllowed: boolean, editAllowed: boolean,
 *                scopeCount: number}>} people
 */
export function summarizeVentureStrictAudit(people = []) {
  const rows = (people || []).map((person) => ({
    cid: person.cid,
    name: person.name || null,
    role: person.role || null,
    ventures: (person.ventures || []).length,
    scopeCount: Number(person.scopeCount || 0),
    viewAllowed: Boolean(person.viewAllowed),
    editAllowed: Boolean(person.editAllowed),
    // A person attached to ventures who cannot read them is the signal that a
    // grant (or an assignment) is missing.
    missing: !person.viewAllowed
      ? ["ventures.view"]
      : !person.editAllowed
        ? ["ventures.edit"]
        : [],
  }));
  const viewMissing = rows.filter((row) => !row.viewAllowed);
  const editMissing = rows.filter((row) => row.viewAllowed && !row.editAllowed);
  return {
    total: rows.length,
    viewAllowed: rows.length - viewMissing.length,
    viewMissing,
    editMissing,
    rows,
  };
}