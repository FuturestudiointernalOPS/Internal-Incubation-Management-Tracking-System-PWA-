/**
 * server/authz — program access resolution.
 *
 * Answers "what is this person's standing in this program?" — which assignment
 * they hold (the legacy program-staff table first, then the generalized contact
 * roles) and the effective access level for a capability inside it.
 *
 * The queries live in @/models/authorization/accessQueries; this module owns the
 * resolution order and the merge rules.
 */

import {
  listProfileCapabilities,
  getFacilitatorDefaultPermissions,
} from "@/models/authorization/accessQueries";
import { resolveProgramAssignment as resolveStanding } from "@/services/authorization/programAssignment";
import { shadowCheck, shadowEnabled } from "@/services/authorization/shadow";


/**
 * Resolves the FACILITATOR assignment for (program, user). Delegates to the one
 * assignment calculation (Lot 3, step 3.3), narrowed to the facilitator role, so
 * this guard and the scoped decision can never answer differently about the same
 * question.
 */
export async function resolveProgramAssignment(programId, userCid, userEmail = null) {
  return resolveStanding({ programId, userCid, userEmail, role: "facilitator" });
}

/**
 * The TARGET source of a facilitator's rights (D-5): the assignment's PROFILE,
 * then the program default. Returns `{ found, level }` so an explicit 0 in the
 * profile is not confused with "not configured" (which falls through to the
 * program default).
 */
async function levelFromProfileOrDefault(programId, assignment, capability) {
  if (assignment?.profile_key) {
    // Fall back to the assignment's PROFILE capabilities (by key).
    // Profile rows are (module, capability, access_level); overrides use
    // "module.capability" dot keys — normalize both sides for the lookup.
    try {
      const profRows = await listProfileCapabilities(assignment.profile_key);
      for (const row of profRows) {
        const dotKey = `${row.module}.${row.capability}`;
        if (dotKey === capability || row.capability === capability) {
          return { found: true, level: Number(row.access_level) || 0 };
        }
      }
    } catch (_) {}
  }

  let def = await getFacilitatorDefaultPermissions(programId);
  if (typeof def === "string") {
    try { def = JSON.parse(def); } catch { def = null; }
  }
  if (def && typeof def[capability] === "number") {
    return { found: true, level: def[capability] };
  }
  return { found: false, level: 0 };
}

/** The per-assignment checkbox level, or null when that source says nothing. */
function overrideLevelFor(assignment, capability) {
  if (!assignment?.permissions) return null;
  let ov = assignment.permissions;
  if (typeof ov === "string") {
    try { ov = JSON.parse(ov); } catch { ov = null; }
  }
  if (ov && typeof ov[capability] === "number") return ov[capability];
  return null;
}

/**
 * Resolves the effective access level for a capability within a program.
 * Individual override beats the profile, which beats the program default.
 * Returns 0 when denied.
 *
 * D-5 (profile as the single source) is measured here: with shadow mode on, the
 * answer the PROFILE would give is computed alongside and any divergence is
 * logged, WITHOUT changing the outcome. The switch itself waits until the
 * profile is populated and the shadow report is clean.
 */
export async function getFacilitatorPermissionLevel(programId, assignment, capability) {
  try {
    const overrideLevel = overrideLevelFor(assignment, capability);

    if (!shadowEnabled()) {
      if (overrideLevel !== null) return overrideLevel;
      return (await levelFromProfileOrDefault(programId, assignment, capability)).level;
    }

    const target = await levelFromProfileOrDefault(programId, assignment, capability);
    shadowCheck({
      legacyAllowed: (overrideLevel ?? target.level) >= 1,
      engineAllowed: target.level >= 1,
      meta: { resource: "program", policy: "facilitator_rights", capability },
    });
    return overrideLevel !== null ? overrideLevel : target.level;
  } catch {
    return 0;
  }
}
