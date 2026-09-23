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
  getProgramFacilitatorAssignment,
  getProgramAssignment,
  listProfileCapabilities,
  getFacilitatorDefaultPermissions,
} from "@/models/authorization/accessQueries";


/**
 * Resolves the assignment for (program, user): legacy v2_program_staff path first
 * (keeps existing facilitators working unchanged), then the generalized
 * contact_roles layer as fallback. Returns null when neither exists.
 */
export async function resolveProgramAssignment(programId, userCid, userEmail = null) {
  const legacy = await getProgramFacilitatorAssignment(programId, userCid, userEmail);
  if (legacy) return { source: "v2_program_staff", assignment: legacy };
  const generalized = await getProgramAssignment(programId, userCid, userEmail);
  if (generalized) return { source: "contact_roles", assignment: generalized };
  return null;
}

/**
 * Resolves the effective access level for a capability within a program.
 * Individual override beats the program default. Returns 0 when denied.
 */
export async function getFacilitatorPermissionLevel(programId, assignment, capability) {
  let level = 0;
  try {
    let found = false;
    if (assignment?.permissions) {
      let ov = assignment.permissions;
      if (typeof ov === "string") {
        try { ov = JSON.parse(ov); } catch { ov = null; }
      }
      if (ov && typeof ov[capability] === "number") {
        level = ov[capability];
        found = true;
      }
    }
    if (!found && assignment?.access_profile_id) {
      // Fall back to the assignment's Access Profile template capabilities.
      // Profile rows are (module, capability, access_level); overrides use
      // "module.capability" dot keys — normalize both sides for the lookup.
      try {
        const profRows = await listProfileCapabilities(assignment.access_profile_id);
        for (const row of profRows) {
          const dotKey = `${row.module}.${row.capability}`;
          if (dotKey === capability || row.capability === capability) {
            level = Number(row.access_level) || 0;
            found = true;
            break;
          }
        }
      } catch (_) {}
    }
    if (!found) {
      let def = await getFacilitatorDefaultPermissions(programId);
      if (typeof def === "string") {
        try { def = JSON.parse(def); } catch { def = null; }
      }
      if (def && typeof def[capability] === "number") level = def[capability];
    }
  } catch {
    level = 0;
  }
  return level;
}
