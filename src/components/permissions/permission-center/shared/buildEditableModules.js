/**
 * MODULE CATALOG BUILDER — shared, extracted from `PermissionCenter.js`.
 *
 * Lives under `shared/` rather than inside either consumer because it has TWO:
 * the permission shell builds its matrix from it AND the access-profile editor
 * builds its section list from it. Putting it in either file would leave the
 * other reaching sideways into a sibling module for a function that belongs to
 * neither. Nothing here is React — it is a pure projection over the registry, so
 * it stays testable without a component tree.
 */

import { CAPABILITY_CATALOG } from "@/models/authorization/capability-catalog";

/**
 * The module catalog the Access-Profile editor can EDIT: the server-served
 * PERMISSION_MODULES (the write-validated set) UNION every non-locked module of
 * the registry (CAPABILITY_CATALOG), shaped as { name, capabilities: string[] }.
 *
 * Why: MODULE_TO_FEATURE maps some modules (bulk_upload) that PERMISSION_MODULES
 * does not carry, so a feature would show only part of its sub-sections. Locked
 * modules (duplicates) stay out — they are super-admin role-locked.
 */
export default function buildEditableModules(permissionModules) {
  const out = { ...(permissionModules || {}) };
  for (const [mod, def] of Object.entries(CAPABILITY_CATALOG)) {
    if (out[mod] || def.locked) continue;
    out[mod] = { name: def.name, capabilities: Object.keys(def.capabilities || {}) };
  }
  return out;
}
