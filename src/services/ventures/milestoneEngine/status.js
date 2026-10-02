/**
 * milestoneEngine — A milestone status derived from its deliverables and tasks, the sync and the completion.
 *
 * Part of `services/ventures/milestoneEngine` (split out of the former single
 * 548-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/milestoneEngine.js`.
 */
import {
  MILESTONE_BLOCKED,
  MILESTONE_UPCOMING,
  isMilestoneComplete,
  isTaskComplete,
} from "@/lib/ventureStatuses";
import {
  completeMilestoneRow,
  selectActiveTaskStatusesForMilestone,
  selectDeliverableStatesForMilestone,
  selectMilestoneForSync,
  selectTaskStatusesForMilestonePlain,
  updateMilestoneStatusRow,
} from "@/models/ventureMilestoneEngineStore";
import { activateDueStages, completeStageIfAllMilestonesDone } from "./availability";

/** Task states that mean work has BEGUN. A review outcome counts: a task that
 *  was submitted and sent back (`rejected`, `revision_requested`) has plainly
 *  started, even though its status is no longer "in progress". */
const TASK_UNDER_WAY_STATUSES = ["in_progress", "review", "rejected", "revision_requested"];

export function rowsOf(result) {
  return (result && result.rows) || [];
}

/**
 * The milestone's OWN status follows the WORK inside it.
 *
 * This is a PURE derivation from the deliverables' own states: it reflects the
 * work, it does not decide anything. Moving the milestone — and closing it — is
 * done by `syncMilestoneStatusFromDeliverables` below.
 *
 * Precedence, most actionable first:
 *   every deliverable approved → completed
 *   any deliverable sent back  → changes_requested  (the founder must act)
 *   any deliverable awaiting review → under_review
 *   anything started              → in_progress
 *   nothing started               → not_started
 *
 * Returns one of the milestone statuses, or null when the milestone has no
 * deliverables (there is no work to reflect).
 */
export function deriveMilestoneStatusFromDeliverables(deliverables = []) {
  const list = (deliverables || []).filter(Boolean);
  if (list.length === 0) return null;

  const stateOf = (deliverable) => {
    const approval = String(deliverable.approval_status || "").trim().toLowerCase();
    const status = String(deliverable.status || "").trim().toLowerCase();
    if (approval === "approved" || status === "approved" || status === "completed" || status === "accepted") return "approved";
    if (approval === "rejected" || status === "changes_requested" || status === "revision_requested") return "changes_requested";
    if (status === "submitted" || status === "under_review" || status === "review") return "awaiting_review";
    if (status === "in_progress") return "in_progress";
    return "not_started";
  };

  const states = list.map(stateOf);
  if (states.every((state) => state === "approved")) return "completed";
  if (states.includes("changes_requested")) return "changes_requested";
  if (states.includes("awaiting_review")) return "under_review";
  if (states.includes("in_progress") || states.includes("approved")) return "in_progress";
  return "not_started";
}

/**
 * A milestone's EXECUTION signal, derived purely from its tasks' states.
 *
 *   null           — no tasks: there is no execution component to reflect
 *   "not_started"  — nothing has begun
 *   "in_progress"  — work is under way, or partly done
 *   "all_done"     — every task is finished
 *
 * "all_done" is deliberately NOT a milestone status. Finishing the work is one
 * half of the outcome; approved evidence is the other. So this reports a
 * SIGNAL, and `combineMilestoneStatus` decides what it means together with the
 * evidence — tasks alone never close a milestone.
 *
 * Cancelled work is not required work, so it is left out entirely (a milestone
 * whose tasks were all cancelled has no execution component left to wait for).
 * A task whose completion was REJECTED in review is not done — it is back in
 * the team's hands, counted as under way rather than untouched.
 */
export function deriveMilestoneStatusFromTasks(tasks = []) {
  const list = (tasks || [])
    .filter(Boolean)
    .filter((task) => String(task.status || "").trim().toLowerCase() !== "cancelled");
  if (list.length === 0) return null;

  const statuses = list.map((task) => String(task.status || "").trim().toLowerCase());
  if (statuses.every((status) => isTaskComplete(status))) return "all_done";
  if (statuses.some((status) => TASK_UNDER_WAY_STATUSES.includes(status))) return "in_progress";
  // Only reached when nothing is under way: then a finished task beside an
  // untouched one is partial execution.
  if (statuses.some((status) => isTaskComplete(status))) return "in_progress";
  return "not_started";
}

/**
 * The ONE place the two halves of a milestone are combined.
 *
 *   Tasks        = execution — did the work happen?
 *   Deliverables = evidence  — is there approved proof?
 *   Milestone    = outcome   — only when BOTH hold, and an authority signs off.
 *
 * A decision the evidence is waiting on outranks progress: a milestone sent
 * back is sent back, however much work is under way.
 */
export function combineMilestoneStatus({ fromDeliverables = null, fromTasks = null } = {}) {
  // 1. Something is waiting on a person — say so, ahead of any progress.
  if (fromDeliverables === "changes_requested") return "changes_requested";
  if (fromDeliverables === "under_review") return "under_review";

  // 2. Completion needs BOTH halves. Approved evidence with work still open is
  //    not an achieved outcome — the execution component is outstanding.
  if (fromDeliverables === "completed") {
    return fromTasks === null || fromTasks === "all_done" ? "completed" : "in_progress";
  }

  // 3. Anything under way — the work, or the evidence — is In Progress.
  if (fromTasks === "in_progress" || fromTasks === "all_done") return "in_progress";
  if (fromDeliverables === "in_progress") return "in_progress";

  // 4. Nothing has begun.
  return "not_started";
}

/**
 * Move a milestone to the status the work inside it implies, after a TASK or a
 * DELIVERABLE changed. This is the one sync: the deliverable route and the task
 * route both come through here, so a milestone can never hold two opinions.
 *
 * Two lines are never crossed:
 *   - a HELD milestone (`upcoming` — its Journey has not started — or `blocked`
 *     — a dependency it declares is unmet) is unreleased planning; the work
 *     inside it cannot be what releases it, and
 *   - a `completed` milestone is the manager's decision already taken; later
 *     work never reopens it.
 *
 * Completion keeps its AUTHORITY and its CONDITIONS: it takes every task
 * finished AND every deliverable approved, and then only an actor who may
 * complete milestones (the Lead Manager / a Super Admin) closes it — with the
 * usual consequence that closing the last one closes the Journey. A scoped
 * coach, who may REVIEW a deliverable but holds no `milestones.edit`, can move
 * the milestone as far as `in_progress` and no further.
 *
 * Returns { changed, status, journey_completed?, journey? }.
 */
export async function syncMilestoneFromWork({ dbId, milestoneId, cid = null, canComplete = false }) {
  if (!milestoneId || !dbId) return { changed: false, status: null };
  try {
    const milestone = rowsOf(await selectMilestoneForSync(milestoneId, dbId).catch(() => ({ rows: [] })))[0];
    if (!milestone) return { changed: false, status: null };
    if (
      milestone.status === MILESTONE_UPCOMING ||
      milestone.status === MILESTONE_BLOCKED ||
      milestone.status === "locked" ||
      isMilestoneComplete(milestone.status)
    ) {
      return { changed: false, status: milestone.status };
    }

    const deliverablesResult = await selectDeliverableStatesForMilestone(milestoneId).catch(() => ({ rows: [] }));

    // Archived tasks are the Venture's record, not its workload. `is_archived`
    // is added by the Venture schema self-heal, so a database that predates it
    // must still answer — the plain read is the fallback.
    const tasksResult = await selectActiveTaskStatusesForMilestone(milestoneId).catch(() =>
      selectTaskStatusesForMilestonePlain(milestoneId).catch(() => ({ rows: [] })),
    );

    const fromDeliverables = deriveMilestoneStatusFromDeliverables(rowsOf(deliverablesResult));
    const fromTasks = deriveMilestoneStatusFromTasks(rowsOf(tasksResult));

    // A milestone with nothing inside it has nothing to reflect — the status a
    // person gave it stands, exactly as before tasks were consulted.
    if (fromDeliverables === null && fromTasks === null) {
      return { changed: false, status: milestone.status };
    }

    let target = combineMilestoneStatus({ fromDeliverables, fromTasks });
    if (!target || target === milestone.status) return { changed: false, status: milestone.status };

    if (target === "completed") {
      if (!canComplete) {
        // The conditions are met, but closing a milestone is not the reviewer's call.
        target = "in_progress";
      } else {
        await completeMilestone({ dbId, milestoneId });
        const stageOutcome = await completeStageIfAllMilestonesDone({
          dbId,
          stageId: milestone.journey_stage_id,
          cid,
        });
        // Immediate release: work held back only by this milestone is offered
        // now, instead of waiting for the next time the roadmap is read.
        await activateDueStages({ dbId });
        return {
          changed: true,
          status: "completed",
          milestone_title: milestone.title || null,
          journey_completed: Boolean(stageOutcome?.completed),
          journey: stageOutcome?.completed
            ? {
                id: milestone.journey_stage_id ? String(milestone.journey_stage_id) : null,
                name: stageOutcome.stage_name || null,
              }
            : null,
        };
      }
    }

    await updateMilestoneStatusRow(target, milestoneId, dbId);
    return { changed: true, status: target };
  } catch (_) {
    return { changed: false, status: null };
  }
}

/**
 * The deliverable-facing name for the same sync. The deliverable route calls
 * this; keeping the name (and one implementation) is what stops the task path
 * and the evidence path from drifting into two different opinions.
 */
export async function syncMilestoneStatusFromDeliverables(options = {}) {
  return syncMilestoneFromWork(options);
}

/**
 * Mark a milestone completed. There is no chain to advance: the other
 * milestones of an active Journey are already available (explicit
 * dependencies are the only thing that ever holds one back),
 * and a Journey closes itself when its last milestone lands
 * (completeStageIfAllMilestonesDone).
 * Assumes the caller already verified completion authority.
 */
export async function completeMilestone({ dbId, milestoneId }) {
  await completeMilestoneRow(milestoneId, dbId);
  return { ok: true };
}
