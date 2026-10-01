/**
 * contextGrants.js — COMPATIBILITY FACADE over the split context→profile
 * mechanism.
 *
 * This file used to BE the mechanism: 538 lines holding the supported-role
 * registry, the pure planner, the justification resolution, the reconcile, the
 * sweeps, the on-connect path and the revocation. It is now a pure re-export of
 * seven focused modules, and it deliberately re-exports rather than
 * re-implements.
 *
 *   contextGrantPlan.js           — supported roles, the `granted_by` sentinel,
 *                                    the pure change planner. Imports nothing.
 *   contextGrantJustification.js  — "why do these grants exist, and what should
 *                                    they be?" for the three supported pairs
 *   contextGrantCache.js          — drop the cached context after a write, and
 *                                    swallow the failure on purpose
 *   contextGrantReconcile.js      — the apply path for ONE person
 *   contextGrantSweep.js          — backfill, drift repair, the everywhere sweep
 *   contextGrantOnConnect.js      — the cost-bounded hot read path
 *   contextGrantRevoke.js         — immediate effect of a disabled mapping
 *
 * Why a facade and not a straight deletion: four suites `jest.mock` this exact
 * path — two of them `@/models/authorization/contextGrants`, which re-exports
 * it. Identity has to survive the split, not just presence.
 *
 * The mechanism's design rules are unchanged and are pinned by tests:
 * ADDITIVE ONLY (grants merge by MAX, nothing is downgraded), ATTRIBUTABLE
 * (every row is stamped `ctx:<context>:<role>`, and that stamp is the only
 * thing a removal may match, so a manual grant is never touched), REVERSIBLE
 * (ending the relationship withdraws exactly what it granted).
 *
 * New code imports the focused module it needs. This facade is deleted once
 * `grep` finds no importer — see docs/LAYER_SPLIT.md.
 */

export { SUPPORTED_CONTEXT_ROLES, contextGrantSentinel, planContextGrantChanges } from "./contextGrantPlan";
export { resolveContextDesiredCaps } from "./contextGrantJustification";
export { syncContextGrantsForUser } from "./contextGrantReconcile";
export { syncAllContextGrants, syncAllContextGrantsEverywhere } from "./contextGrantSweep";
export { syncContextGrantsOnConnect } from "./contextGrantOnConnect";
export { revokeAllContextGrants } from "./contextGrantRevoke";
