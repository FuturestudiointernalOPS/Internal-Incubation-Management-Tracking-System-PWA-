/**
 * ImpactOS — Authorization Foundation: SCOPE CATALOGUE (Phase 5, PURE MODULE).
 *
 * No database imports — safe to share with client components (the Scope
 * Policies governance view) and tests, exactly like `eligibility-defaults`.
 * The executable predicates live in ./scope.js.
 *
 * SCOPE answers the third authorization question — after eligibility ("may
 * this identity ever do X?") and capability ("does this person hold X?"):
 *
 *     "WHICH RECORDS may the capability operate on?"
 *
 * The security decision for scoped records comes from the ACTUAL data-layer
 * predicate reading assignment rows — never from cache freshness, and never
 * from client state. See ./scope.js.
 */

export const SCOPE_POLICY_KEYS = [
  "venture_own",
  "program_assigned",
  "learning_own",
  "team_own",
];

/**
 * Policy catalogue — the shared vocabulary for the Scope Policies governance
 * surface AND the engine. `implemented` is the honest state of each predicate:
 * a declared-but-unimplemented policy resolves to DENY (never silently allow).
 */
export const SCOPE_POLICIES = {
  venture_own: {
    key: "venture_own",
    resource: "venture",
    implemented: true,
    source: "venture_members (active membership: user_cid or contact_id, removed_at IS NULL)",
  },
  program_assigned: {
    key: "program_assigned",
    resource: "program",
    implemented: true,
    source:
      "v2_program_staff (assignment, email-tolerant) + participant_programs (enrollment)",
  },
  learning_own: {
    key: "learning_own",
    resource: "course",
    implemented: true,
    source: "lms_enrollments (own enrollments, suspended excluded)",
  },
  team_own: {
    key: "team_own",
    resource: "team",
    implemented: false,
    source: "pending — v2_teams mapping not resolved yet",
  },
};

/** Decision reasons (machine codes — callers map to UI copy). */
export const SCOPE_DECISION_REASONS = {
  ALLOWED: "allowed",
  CAPABILITY_MISSING: "capability-missing",
  POLICY_UNSUPPORTED: "policy-unsupported",
  OUT_OF_SCOPE: "out-of-scope",
  UNRESOLVED: "unresolved",
};

export function isScopePolicyImplemented(policyKey) {
  return Boolean(SCOPE_POLICIES[policyKey]?.implemented);
}

/**
 * Pure composition of the scoped decision. Exported for tests and for route
 * helpers so every consumer shares one contract:
 *
 *     capability first (resolver authoritative)
 *     → policy supported (fail closed)
 *     → within scope (fail closed on error / unknown / empty)
 *
 * @param {{capabilityHeld: boolean, policyKey: string, withinScope: boolean}} input
 * @returns {{allowed: boolean, reason: string}}
 */
export function evaluateScopeDecision({ capabilityHeld, policyKey, withinScope }) {
  if (!capabilityHeld) {
    return { allowed: false, reason: SCOPE_DECISION_REASONS.CAPABILITY_MISSING };
  }
  if (!isScopePolicyImplemented(policyKey)) {
    return { allowed: false, reason: SCOPE_DECISION_REASONS.POLICY_UNSUPPORTED };
  }
  if (!withinScope) {
    return { allowed: false, reason: SCOPE_DECISION_REASONS.OUT_OF_SCOPE };
  }
  return { allowed: true, reason: SCOPE_DECISION_REASONS.ALLOWED };
}
