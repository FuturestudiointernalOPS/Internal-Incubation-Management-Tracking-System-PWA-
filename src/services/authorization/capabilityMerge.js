/**
 * CAPABILITY ALGEBRA (SERVICE layer).
 *
 * The four functions that turn stored rows into an effective access picture,
 * and nothing else. They are the arithmetic of the permission system:
 *
 *   rows → max-merge per capability → subtract restrictions → effective
 *
 * This module imports NOTHING. That is the point: the rules that decide what
 * somebody may do are the part most worth testing in isolation, and they stay
 * testable only as long as nothing reaches a database, a session or the clock
 * from here.
 *
 * Two of the four are exported for the wire:
 *   - `restrictionsToJson` exists because a Set does not survive JSON. Without
 *     it a restricted capability would reach the client as "no restriction"
 *     and the UI would report it as allowed.
 *   - `mergeEffectiveCapabilities` encodes the V2 semantics: effective =
 *     MAX(base, group, grants) − restrictions, where a restriction REMOVES a
 *     capability and never merely lowers it.
 *
 * Split out of `context.js` (560 lines). Behaviour identical.
 */

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

/** Group DB rows [{module, capability, access_level}] into {module:{cap:level}} (max-merge). */
export function rowsToCaps(rows) {
  const capabilities = {};
  for (const row of rows || []) {
    capabilities[row.module] ??= {};
    const level = Number(row.access_level ?? 0);
    if (level > (capabilities[row.module][row.capability] ?? 0)) {
      capabilities[row.module][row.capability] = level;
    }
  }
  return capabilities;
}

/** Group DB rows [{module, capability}] into {module:Set(capabilities)}. */
export function rowsToRestrictions(rows) {
  const restrictions = {};
  for (const row of rows || []) {
    restrictions[row.module] ??= new Set();
    restrictions[row.module].add(row.capability);
  }
  return restrictions;
}

/**
 * JSON projection of a restrictions map (`{module: Set(capability)}`).
 *
 * Restrictions are Sets because merge/authorize iterate them server-side, but a
 * Set does not survive JSON (`JSON.stringify(new Set(["view"]))` is `{}`). A
 * client reading the source layers over the wire would then see NO restriction
 * at all and report a restricted capability as allowed. Project the Sets into
 * the `{module: {capability: true}}` shape the client reads so the wire format
 * and the runtime format agree. Tolerance for the object shape keeps the
 * projection idempotent.
 */
export function restrictionsToJson(restrictions) {
  const output = {};
  for (const [module, capabilities] of Object.entries(restrictions || {})) {
    output[module] = {};
    const capabilityList =
      capabilities instanceof Set
        ? capabilities
        : Object.keys(capabilities || {});
    for (const capability of capabilityList) output[module][capability] = true;
  }
  return output;
}

/**
 * V2 merge semantics: effective = MAX(base, group, grants) − restrictions.
 * Restrictions remove the capability entirely (they never lower it).
 */
export function mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions) {
  const merged = {};
  const add = (sourceCaps) => {
    for (const [module, capabilities] of Object.entries(sourceCaps || {})) {
      merged[module] ??= {};
      for (const [capability, level] of Object.entries(capabilities)) {
        if (level > (merged[module][capability] ?? 0)) merged[module][capability] = level;
      }
    }
  };
  add(baseCaps);
  add(groupCaps);
  add(grants);
  for (const [module, capabilities] of Object.entries(restrictions || {})) {
    if (!merged[module]) continue;
    for (const capability of capabilities) delete merged[module][capability];
  }
  return merged;
}
