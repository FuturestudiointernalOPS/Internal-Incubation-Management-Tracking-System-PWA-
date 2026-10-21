/**
 * ONE ASSIGNMENT CALCULATION — "what is this person's standing in this program?"
 *
 * Two modules used to answer this question with different rules:
 *
 *   - the facilitator guard saw only `facilitator` rows in the staff table;
 *   - the scoped decision saw any staff role.
 *
 * Same question, two answers, depending on which door asked. This module is the
 * single answer (Lot 3, step 3.3):
 *
 *   1. the LEGACY staff row for this program (staff_id may hold a cid OR an
 *      email), optionally narrowed to one role;
 *   2. otherwise the generalized `contact_roles` layer (its current row).
 *
 * A caller that asks a role-specific question passes `role`; a caller that asks
 * "do they hold ANY assignment here?" passes nothing. The role filter applies to
 * the staff table, exactly as the facilitator guard always did; the
 * generalized layer keeps its historical behaviour and is not filtered.
 *
 * Returns `{ source: "v2_program_staff" | "contact_roles", assignment }` or
 * `null`. Read-only; never fabricates an assignment.
 *
 * Layer: SERVICE. It reads through `@/models/**` and runs no SQL.
 */

import { getProgramAssignment } from "@/models/authorization/accessQueries";
import { getProgramStaffAssignmentRows } from "@/models/authorization/contextAssignmentReads";

/**
 * @param {{programId: string|number|null, userCid: string|null,
 *          userEmail?: string|null, role?: string|null}} params
 * @returns {Promise<{source: string, assignment: object}|null>}
 */
export async function resolveProgramAssignment({
  programId,
  userCid,
  userEmail = null,
  role = null,
} = {}) {
  if (programId === null || programId === undefined || programId === "") return null;
  if (!userCid) return null;

  const staffRows = await getProgramStaffAssignmentRows(programId, userCid, userEmail, role);
  if (staffRows.length > 0) {
    return { source: "v2_program_staff", assignment: staffRows[0] };
  }

  const generalized = await getProgramAssignment(programId, userCid, userEmail);
  if (!generalized) return null;
  return { source: "contact_roles", assignment: generalized };
}
