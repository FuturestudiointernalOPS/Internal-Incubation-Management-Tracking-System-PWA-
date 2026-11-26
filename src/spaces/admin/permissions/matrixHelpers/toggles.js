/**
 * Permission Center matrix helpers — capability toggles.
 *
 * Immutable toggles for a single capability and for the collective "Full"
 * column, applying the product dependencies. Pure: no React, no DB.
 */

import { capabilityLevel } from "./capabilities";

function cloneModule(caps, module) {
  return { ...(caps || {}), [module]: { ...((caps || {})[module] || {}) } };
}

/**
 * Toggle ONE capability of ONE module, applying the product dependencies:
 *
 *   1. View is the base capability — checking any other capability also checks
 *      View, and clearing View clears every other capability of the module.
 *   2. Capability families (optional `parents` map { child → parent }): checking
 *      a child also checks its parent; clearing a parent clears its children.
 *      A parent NEVER auto-checks its children (granting `edit` must not grant
 *      `archive`/`publish`) — the dependency only runs child → parent upwards,
 *      and parent → children on clear.
 *
 * @param {Object} caps              capabilities matrix ({module:{cap:level}})
 * @param {string} module
 * @param {string} capability
 * @param {boolean} checked
 * @param {string[]} moduleCapabilities  every capability of the module
 * @param {Object} [parents]         { childCapability → parentCapability }
 * @returns a NEW capabilities matrix (never mutates the input)
 */
export function toggleCapability(caps, module, capability, checked, moduleCapabilities = [], parents = {}) {
  const next = cloneModule(caps, module);
  const hasView = moduleCapabilities.includes("view");
  const parent = parents?.[capability] || null;
  const children = Object.keys(parents || {}).filter((child) => parents[child] === capability);

  if (checked) {
    next[module][capability] = capabilityLevel(capability);
    if (parent && !(Number(next[module][parent]) > 0)) {
      next[module][parent] = capabilityLevel(parent);
    }
    if (hasView && capability !== "view" && !(Number(next[module].view) > 0)) {
      next[module].view = capabilityLevel("view");
    }
  } else {
    next[module][capability] = 0;
    for (const child of children) next[module][child] = 0;
    if (capability === "view") {
      for (const other of moduleCapabilities) {
        if (other !== "view") next[module][other] = 0;
      }
    }
  }
  return next;
}

/**
 * Toggle the collective "Full" column for one module: every capability of the
 * module is set to level 5 (checked) or 0 (unchecked).
 */
export function toggleFullCapabilities(caps, module, checked, moduleCapabilities = []) {
  const next = cloneModule(caps, module);
  for (const capability of moduleCapabilities) {
    next[module][capability] = checked ? 5 : 0;
  }
  return next;
}

/** True when every capability of the module is held at level 5. */
export function isModuleFull(caps, module, moduleCapabilities = []) {
  if (moduleCapabilities.length === 0) return false;
  return moduleCapabilities.every(
    (capability) => Number((caps || {})[module]?.[capability] ?? 0) === 5,
  );
}
