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
import { ensureCapabilityBackfills } from "@/models/authorization/backfill";
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
  // The KEY is explicit when the assignment carries one. Otherwise a known
  // role resolves to its profile, so a facilitator assignment created AFTER the
  // one-time backfill still reads the profile instead of silently losing every
  // right.
  const profileKey =
    assignment?.profile_key ||
    (String(assignment?.role || "") === "facilitator" ? "facilitator" : null);

  if (profileKey) {
    // Profile rows are (module, capability, access_level); overrides use
    // "module.capability" dot keys — normalize both sides for the lookup.
    try {
      const profRows = await listProfileCapabilities(profileKey);
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
 *
 * D-5 — the PROFILE is the single source: the assignment's profile (or the
 * profile its role derives to), then the program default. The per-assignment
 * checkboxes are IGNORED; they are measured in shadow against the profile so a
 * divergence is visible, but they no longer decide.
 *
 * Returns 0 when denied.
 */
export async function getFacilitatorPermissionLevel(programId, assignment, capability) {
  try {
    // D-5 depends on two one-time migrations (the facilitator profile and the
    // assignment key). The authorization resolver already awaits them before any
    // decision; this guard does not pass through it, so it waits too. Memoised
    // per process — a no-op after the first call.
    await ensureCapabilityBackfills();

    const target = await levelFromProfileOrDefault(programId, assignment, capability);

    // Transition measurement: the checkbox rule that used to win is computed
    // alongside and logged, without changing the outcome.
    if (shadowEnabled()) {
      const overrideLevel = overrideLevelFor(assignment, capability);
      const legacyLevel = overrideLevel !== null ? overrideLevel : target.level;
      shadowCheck({
        legacyAllowed: legacyLevel >= 1,
        engineAllowed: target.level >= 1,
        meta: { resource: "program", policy: "facilitator_rights", capability },
      });
    }

    return target.level;
  } catch {
    return 0;
  }
}
