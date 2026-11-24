/**
 * Deliverables — authority rules (Vinance 3, agreed model).
 *
 *   create / edit the deliverable definition : Venture Manager or Super Admin
 *   submit the evidence                      : the Venture side (any member
 *                                              with Venture access)
 *   review (approve / request changes)       : Venture Manager, Super Admin, or a
 *                                              staff member whose assignment
 *                                              scope covers this milestone /
 *                                              journey (venture-wide, lead,
 *                                              milestone- or stage-scoped)
 *
 * Approval never gates milestone completion: the Venture Manager remains the
 * authority for completing a milestone and simply sees the evidence state.
 */

import { getAssignmentScopes, hasVentureWideReach, isTaskInScope } from "@/services/ventures/scope";
import { canManageMilestones } from "@/services/ventures/milestoneEngine";

/** Create / edit a deliverable's definition — Venture Manager or Super Admin. */
export async function canDefineDeliverables({ id, cid, session }) {
  // The session carries the portfolio right, so a Super Admin whose `edit_all`
  // right was revoked falls back to the assignment matrix like anyone else.
  return canManageMilestones({ id, cid, session });
}

/**
 * Review a deliverable — Venture Manager / Super Admin, or a staff member whose
 * active assignment scope covers the milestone (or its journey stage).
 * Fails closed: an unresolvable scope is a denial.
 */
export async function canReviewDeliverable({ id, cid, role, milestoneId, journeyStageId }) {
  if (role === "super_admin") return true;
  if (!cid || !milestoneId) return false;
  const scopes = await getAssignmentScopes({ code: id, cid });
  if (!Array.isArray(scopes) || scopes.length === 0) return false;
  if (hasVentureWideReach(scopes)) return true;
  return isTaskInScope(scopes, { milestone_id: milestoneId, journey_stage_id: journeyStageId });
}

export default { canDefineDeliverables, canReviewDeliverable };
