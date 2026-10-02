/**
 * services/ventures/sessionBookingTargets — what a new session is booked
 * against: the milestone (founders only on the one the chain has released),
 * the optional deliverable, and the coach's platform identity.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/sessions/route.js` (lane
 * L2). WHO is booking decides which milestone may carry the session: the
 * Venture books only against the one milestone the chain has released; Future
 * Studio staff plan ahead and may book against any milestone. The refusal
 * carries the reason (locked / already completed / a different milestone is
 * current), so the founder is never left guessing.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import { resolveCoachContact } from "@/services/ventures/coach";
import { getDeliverable } from "@/services/ventures/deliverables";
import { assertBookableMilestone, activateDueStages } from "@/services/ventures/milestoneEngine";
import { getVentureDbIdByCodeOrId } from "@/models/ventureWorkspace";

/**
 * @returns {Promise<{ error: string, status: number }
 *   | { deliverableId: string|null, coachContactId: string|null, resolvedCoach: object|null }>}
 */
export async function resolveSessionBookingTargets({ ventureParam, staffActor, milestoneRef, body }) {
  if (!staffActor) {
    const ventureLookup = await getVentureDbIdByCodeOrId(ventureParam).catch(() => ({ rows: [] }));
    const ventureDbId = ventureLookup.rows?.[0]?.id || null;
    // A Journey that starts today is already active when a founder books —
    // activation is date-driven, not a manual step.
    if (ventureDbId) await activateDueStages({ dbId: ventureDbId });
    const bookable = ventureDbId
      ? await assertBookableMilestone({ dbId: ventureDbId, milestoneId: milestoneRef })
      : { ok: false, reason: "This Venture could not be resolved, so the session was not booked." };
    if (!bookable.ok) {
      return { error: bookable.reason, status: 403 };
    }
  }
  // Optional: attach the session to one of the milestone's deliverables.
  let deliverableId = body.deliverable_id ? String(body.deliverable_id) : null;
  if (deliverableId) {
    const deliverable = await getDeliverable(deliverableId).catch(() => null);
    if (!deliverable || String(deliverable.milestone_id) !== milestoneRef) {
      return { error: "Unknown deliverable for this milestone.", status: 400 };
    }
  }
  // Coach identity (Phase 1): explicit coach_contact_id wins; otherwise
  // resolve the legacy catalog coach by email to a platform contact.
  let coachContactId = body.coach_contact_id ? String(body.coach_contact_id) : null;
  let resolvedCoach = null;
  if (!coachContactId && body.coach_id) {
    resolvedCoach = await resolveCoachContact({ coachId: parseInt(body.coach_id) });
    if (resolvedCoach) coachContactId = resolvedCoach.cid;
  }
  return { deliverableId, coachContactId, resolvedCoach };
}
