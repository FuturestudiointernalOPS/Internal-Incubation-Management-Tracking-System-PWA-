/**
 * services/ventures/deliverableReview — the decisions around a deliverable's
 * evidence: how a review decision is read, and what follows a submission or a
 * review (the milestone's own status, its completion notices and history).
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/deliverables/route.js`
 * (lane L2). The controller keeps the access gates (`requireVentureAccess`,
 * `requireVentureScopedAccess`, `canDefineDeliverables`,
 * `canReviewDeliverable`), the writes and every response.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import { canManageMilestones, syncMilestoneStatusFromDeliverables } from "@/lib/ventureMilestoneEngine";
import { notifyVentureFounders } from "@/lib/ventures";

/**
 * Reads the review decision and its comments.
 *
 * @returns {{ ok: true, decision: "approved"|"changes_requested", comments: string|null }
 *          | { ok: false, error: string }} a refusal is sent as a 400
 */
export function readDeliverableDecision(body) {
  const decision = body?.decision === "approved" ? "approved" : body?.decision === "changes_requested" ? "changes_requested" : null;
  if (!decision) {
    return { ok: false, error: "decision (approved|changes_requested) is required." };
  }
  const comments = String(body?.comments || "").trim() || null;
  if (decision === "changes_requested" && !comments) {
    return { ok: false, error: "Comments are required when requesting changes." };
  }
  return { ok: true, decision, comments };
}

/**
 * The evidence is in: the milestone's OWN status follows its deliverables (a
 * submission moves it to "awaiting review"). A submission is the founder's
 * act, so it can never COMPLETE the milestone — `canComplete` is false and the
 * sign-off stays with the Lead Manager.
 */
export async function afterDeliverableSubmitted({ dbId, milestone, session }) {
  return syncMilestoneStatusFromDeliverables({
    dbId,
    milestoneId: milestone.id,
    cid: session?.cid || null,
    canComplete: false,
  });
}

/**
 * What follows a review: the history row, then the milestone's own status
 * moves with the work — approving some evidence puts it In Progress, returning
 * some puts it Changes Requested, and the LAST approval closes it. Closing a
 * milestone stays the Lead Manager / Super Admin's decision (the same authority
 * the manual complete action requires); a scoped coach's approval stops at In
 * Progress. A completed milestone (and a completed journey) notifies the
 * founders and is written to the history. Notices and history are best-effort.
 *
 * @returns {Promise<object>} the milestone sync result
 */
export async function afterDeliverableReviewed({ ventureParam, dbId, session, milestone, deliverable, decision }) {
  const id = ventureParam;
  try {
    const { addVentureHistory } = await import("@/lib/ventures");
    await addVentureHistory({
      venture_id: id,
      event_type: "DELIVERABLE_REVIEWED",
      description: `Deliverable "${deliverable.title}" ${decision === "approved" ? "approved" : "sent back for changes"}`,
    });
  } catch (_) {}

  const canCompleteMilestone = await canManageMilestones({ id, cid: session?.cid, role: session?.role });
  const milestoneSync = await syncMilestoneStatusFromDeliverables({
    dbId,
    milestoneId: milestone.id,
    cid: session?.cid || null,
    canComplete: canCompleteMilestone,
  });

  if (milestoneSync.status === "completed") {
    try {
      await notifyVentureFounders(
        dbId,
        "Milestone approved",
        `The milestone "${milestoneSync.milestone_title || ""}" has been completed and approved.`,
        { journey_stage_id: milestone.journey_stage_id || null, milestone_id: milestone.id },
        { templateKey: "venture.notif.milestoneApproved", params: { milestoneTitle: milestoneSync.milestone_title || "" }, dedupeKey: `milestone-completed:${milestone.id}` },
      );
    } catch (_) {}
    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({
        venture_id: id,
        event_type: "MILESTONE_COMPLETED",
        description: `Milestone "${milestoneSync.milestone_title || milestone.id}" completed — every deliverable approved`,
      });
    } catch (_) {}

    if (milestoneSync.journey_completed) {
      try {
        await notifyVentureFounders(
          dbId,
          "Journey completed",
          `All milestones in "${milestoneSync.journey?.name || "your journey"}" are completed.`,
          { journey_stage_id: milestone.journey_stage_id || null },
          {
            templateKey: "venture.notif.journeyCompleted",
            params: { stageName: milestoneSync.journey?.name || "" },
            dedupeKey: `journey-completed:${milestone.journey_stage_id}`,
          },
        );
      } catch (_) {}
      try {
        const { addVentureHistory } = await import("@/lib/ventures");
        await addVentureHistory({
          venture_id: id,
          event_type: "JOURNEY_COMPLETED",
          description: `Journey "${milestoneSync.journey?.name || ""}" completed — all milestones are done`,
        });
      } catch (_) {}
    }
  }
  return milestoneSync;
}
