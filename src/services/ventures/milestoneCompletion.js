/**
 * services/ventures/milestoneCompletion — what follows a milestone save.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/milestones/route.js`
 * (PATCH, lane L2). The controller keeps the scoped access gate, the
 * completion authority (Lead Manager / Super Admin), the field validation
 * (isValidCid, dateOrNull…), the write and the response. This module writes
 * the field-level history and, on completion, settles the Journey: releases,
 * notices, history and the automatic close of a journey whose milestones are
 * all done. Notices and history are best-effort.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import { completeMilestone, completeStageIfAllMilestonesDone, activateDueStages } from "@/lib/ventureMilestoneEngine";
import { notifyVentureFounders } from "@/lib/ventures";
import { diffFields, recordVentureChange } from "@/models/ventureChangeLog";
import { getVentureDbIdByCodeOrId, getVentureMilestoneTitleAndStage } from "@/models/ventureWorkspace";

/**
 * Field-level history of a milestone save. Non-fatal by contract — the write
 * already succeeded and must not be undone by a logging failure.
 */
export async function recordMilestoneEdit({ dbId, milestoneId, milestoneBefore, body, session }) {
  const ventureDbIdForScope = dbId;
  try {
    const AUDITED_MILESTONE_FIELDS = [
      "title", "description", "objective", "status", "progress",
      "target_date", "start_date", "priority", "owner_cid", "owner_name", "journey_stage_id", "display_order",
    ];
    const milestoneChanges = diffFields(milestoneBefore, body, AUDITED_MILESTONE_FIELDS);
    if (milestoneChanges.length) {
      await recordVentureChange({
        dbId: ventureDbIdForScope,
        entityType: "milestone",
        entityId: milestoneId,
        entityLabel: milestoneBefore?.title || body.title || null,
        action: "updated",
        actorCid: session?.cid || null,
        actorName: session?.name || null,
        changes: milestoneChanges,
      });
    }
  } catch (_) {}
}

/**
 * Completing a milestone settles the Journey's whole availability in one pass.
 *
 * @returns {Promise<null | { id: string|null, name: string|null }>} the journey
 *   that closed because of this completion, or null
 */
export async function settleMilestoneCompletion({ ventureParam, milestoneId, session }) {
  const id = ventureParam;
  // Completing a milestone settles the Journey's whole availability in one
  // pass: the milestones whose ONLY remaining blocker was this one become
  // available right away (a dependency-held one becomes `blocked`), and a due
  // Journey opens. The Journey outcome is carried out below so the caller can
  // be TOLD a journey just closed — that is the moment its closing report is
  // owed.
  let journeyOutcome = null;
  const ventureResult = await getVentureDbIdByCodeOrId(id).catch(() => ({ rows: [] }));
  const ventureDbId = ventureResult.rows?.[0]?.id || null;
  if (ventureDbId) {
    await completeMilestone({ dbId: ventureDbId, milestoneId });
    // Immediate release: work held back only by THIS milestone is offered
    // now, instead of waiting for the next time the roadmap is read.
    await activateDueStages({ dbId: ventureDbId });
    const milestoneResult = await getVentureMilestoneTitleAndStage(milestoneId).catch(() => ({ rows: [] }));
    const milestone = milestoneResult.rows?.[0];
    try {
      await notifyVentureFounders(
        ventureDbId,
        "Milestone approved",
        `The milestone "${milestone?.title || ""}" has been completed and approved.`,
        { journey_stage_id: milestone?.journey_stage_id || null, milestone_id: milestoneId },
        { templateKey: "venture.notif.milestoneApproved", params: { milestoneTitle: milestone?.title || "" }, dedupeKey: `milestone-completed:${milestoneId}` },
      );
    } catch (_) {}
    try {
      const { addVentureHistory } = await import("@/lib/ventures");
      await addVentureHistory({ venture_id: id, event_type: "MILESTONE_COMPLETED", description: `Milestone "${milestone?.title || milestoneId}" completed` });
    } catch (_) {}

    // A Journey is never closed by hand: once EVERY milestone in it is
    // completed it closes automatically. No other Journey is started here —
    // they activate on their own start dates.
    const stageOutcome = await completeStageIfAllMilestonesDone({
      dbId: ventureDbId,
      stageId: milestone?.journey_stage_id,
      cid: session.cid,
    });
    if (stageOutcome?.completed) {
      journeyOutcome = {
        id: milestone?.journey_stage_id ? String(milestone.journey_stage_id) : null,
        name: stageOutcome.stage_name || null,
      };
      try {
        const { addVentureHistory } = await import("@/lib/ventures");
        await addVentureHistory({
          venture_id: id,
          event_type: "JOURNEY_COMPLETED",
          description: `Journey "${stageOutcome.stage_name || ""}" completed — all milestones are done`,
        });
      } catch (_) {}
      try {
        await notifyVentureFounders(
          ventureDbId,
          "Journey completed",
          `All milestones in "${stageOutcome.stage_name || "your journey"}" are completed.`,
          { journey_stage_id: milestone?.journey_stage_id || null },
          {
            templateKey: "venture.notif.journeyCompleted",
            params: { stageName: stageOutcome.stage_name || "" },
            dedupeKey: `journey-completed:${milestone?.journey_stage_id}`,
          },
        );
      } catch (_) {}
    }
  }
  return journeyOutcome;
}
