/**
 * CONTEXT GRANT PLAN (SERVICE layer).
 *
 * The PURE part of the context → profile mechanism: which context/role pairs
 * exist, the `granted_by` sentinel, and the change planner. Imports NOTHING, and
 * that is the point — the rules that decide which capability rows this mechanism
 * may create and delete stay testable with no database, no session and no clock.
 *
 * The mechanism's three approved rules live here, and each is load-bearing:
 *
 *   - ADDITIVE ONLY. Grants merge by MAX() in the resolver; nothing is ever
 *     downgraded and no identity is mutated.
 *   - ATTRIBUTABLE. `contextGrantSentinel` stamps every row this mechanism
 *     writes (`ctx:<context>:<role>`). It is the ONLY thing removal is allowed
 *     to match, so a manual grant is never overwritten and never deleted.
 *   - REVERSIBLE. `planContextGrantChanges` returns both halves — what to apply
 *     and what to revoke — from the provenance rows this mechanism owns, so
 *     ending a relationship withdraws exactly what it granted.
 *
 * `isoDate` normalises a Date or timestamp to YYYY-MM-DD. It returns null
 * rather than a bad string for an unparseable value, so a malformed expiry
 * reads as "no date" instead of poisoning the comparison.
 *
 * Split out of `contextGrants.js` (538 lines). Behaviour identical.
 */

export const SUPPORTED_CONTEXT_ROLES = [
  { context: "venture", roleKey: "founder" },
  { context: "program", roleKey: "facilitator" },
  { context: "program", roleKey: "program_manager" },
  // Phase E — the newly activated couples (roadmap §7, decision D5: all but
  // venture:team_member). Each has a capability template and a Context Roles
  // registry mapping (see contextProfilesBackfill.js), so turning it on here is
  // what starts reconciling its grants. Additive and reversible.
  { context: "investor", roleKey: "investor" },
  { context: "lms", roleKey: "learner" },
  { context: "venture", roleKey: "venture_manager" },
  // Product request : a program participant is the relationship
  // `participant_programs` carries. The registry maps the pair to the
  // Participant template; the enrollment row is the relationship, so the grant
  // is withdrawn when the enrollment is. Additive and reversible.
  { context: "program", roleKey: "participant" },
];

/** ISO date (YYYY-MM-DD) from a Date or a timestamp string; null when absent. */
function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }
  const iso = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

/** granted_by stamp for grants this module owns — the only rows it may remove. */
export function contextGrantSentinel(context, roleKey) {
  return `ctx:${context}:${roleKey}`;
}

// ── Phase F — the residual read-only consultation ────────────────────────────
//
// When a relationship ends, the ACTIVE grants are withdrawn but the person keeps
// a READ-ONLY view of what they managed. That residual lives in its own
// namespace — a distinct provenance role_key and grant stamp — so the active
// reconcile can never see it, claim it, or remove it (and vice versa).

export const HISTORY_ROLE_PREFIX = "history:";

/** The provenance role_key that carries the residual read for a couple. */
export function historicalRoleKey(roleKey) {
  return `${HISTORY_ROLE_PREFIX}${roleKey}`;
}

/** granted_by stamp for the residual READ rows — the only rows F may remove. */
export function historicalGrantSentinel(context, roleKey) {
  return `hist:${context}:${roleKey}`;
}

/**
 * Pure change plan (unit-tested).
 *
 * @param {Object} args
 * @param {Object} args.desired    { "module.capability": { module, capability, level } }
 * @param {Array}  args.existing   current user_capabilities rows [{module, capability, granted_by}]
 * @param {Array}  args.provenance rows this module applied before [{module, capability}]
 * @param {string} args.sentinel   granted_by stamp owned by this mechanism
 * @param {string|null} [args.expiresAt]  when provided (even null), the grant's
 *   expiry is managed by the caller: a row whose level AND expiry already match
 *   is left alone, so a program whose end date moved is picked up as a change.
 *   When omitted, expiry is out of scope and the previous comparison applies.
 * @returns {{ toApply: Array, toRevoke: Array }}
 */
export function planContextGrantChanges({
  desired = {},
  existing = [],
  provenance = [],
  sentinel,
  expiresAt,
}) {
  const desiredKeys = new Set(Object.keys(desired));
  const existingByKey = new Map(
    (existing || []).map((row) => [`${row.module}.${row.capability}`, row]),
  );

  const managesExpiry = expiresAt !== undefined;
  const expiryMatches = (row) =>
    !managesExpiry || isoDate(row?.expires_at) === isoDate(expiresAt);

  const toApply = [];
  for (const item of Object.values(desired)) {
    const key = `${item.module}.${item.capability}`;
    const current = existingByKey.get(key);
    // A manual grant (or another mechanism's grant) always wins: never
    // overwrite it, never claim it as ours.
    if (current && current.granted_by !== sentinel) continue;
    // Already applied at this level (and expiry, when managed) — nothing to
    // write (keeps the reconcile report honest and the writes minimal).
    if (
      current &&
      Number(current.access_level) === Number(item.level ?? 1) &&
      expiryMatches(current)
    ) {
      continue;
    }
    toApply.push({
      module: item.module,
      capability: item.capability,
      level: Number(item.level ?? 1),
      expiresAt: managesExpiry ? expiresAt : undefined,
    });
  }

  const toRevoke = (provenance || [])
    .filter((row) => !desiredKeys.has(`${row.module}.${row.capability}`))
    .map((row) => ({ module: row.module, capability: row.capability }));

  return { toApply, toRevoke };
}
