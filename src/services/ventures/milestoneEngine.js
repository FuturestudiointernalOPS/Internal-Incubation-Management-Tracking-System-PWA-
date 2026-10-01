/**
 * Milestone progression engine (Vinance 3 — Phase 3; updated: date-driven
 * Journeys, no positional chain).
 *
 * How availability works now:
 *   - a Journey starts on its OWN start_date (activateDueStages) — never by
 *     waiting for another Journey to complete, so Journeys overlap freely;
 *   - a milestone is available as soon as its Journey is: an active Journey's
 *     milestones are all offered (held -> not_started) EXCEPT one whose
 *     explicit dependencies are unmet — that one reads `blocked`. Position
 *     releases nothing; dependencies are the only thing that ever holds a
 *     milestone back;
 *   - a Journey completes automatically the moment every milestone in it is
 *     completed; completing it does NOT start another one.
 *
 * Authority (unchanged): a milestone may ONLY be created, restructured or
 * marked completed by a holder of the permission matrix cell `milestones.edit`
 * — which the seeded Lead Manager holds and a Coach does not — or by a Super
 * Admin. Authority is read from the matrix and nowhere else.
 *
 * Founders see future work through the visibility projection (sealed, with its
 * real status) rather than through a positional lock. Manual overrides by
 * authorized actors are recorded through the normal history/notification
 * events.
 *
 * Every statement lives in `@/models/ventureMilestoneEngineStore`; nothing here
 * runs SQL. Re-exported unchanged through the compatibility facade
 * `@/lib/ventureMilestoneEngine` — see docs/LAYER_SPLIT.md.
 */

import {
  isMilestoneComplete,
  isTaskComplete,
  MILESTONE_UPCOMING,
  MILESTONE_BLOCKED,
} from "@/lib/ventureStatuses";
import { hasVentureCapability } from "@/services/ventures/permissions";
import {
  ARCHIVE_CLAUSE,
  STAGE_ARCHIVE_CLAUSE,
  selectVentureIdAndCodeByIdOrCode,
  selectJourneyStageStatus,
  selectJourneyStageForCompletion,
  selectLiveMilestonesForStage,
  selectLiveMilestonesForStagePlain,
  completeJourneyStageRow,
  releaseHeldMilestonesForStage,
  activateDueJourneyStages,
  holdMilestonesForInactiveStages,
  releaseHeldMilestonesForActiveStages,
  selectUnmetDependencies,
  selectMilestoneForBooking,
  selectMilestoneForBookingPlain,
  selectJourneyStageForBooking,
  selectMilestoneForSync,
  selectDeliverableStatesForMilestone,
  selectActiveTaskStatusesForMilestone,
  selectTaskStatusesForMilestonePlain,
  updateMilestoneStatusRow,
  completeMilestoneRow,
} from "@/models/ventureMilestoneEngineStore";

/** Task states that mean work has BEGUN. A review outcome counts: a task that
 *  was submitted and sent back (`rejected`, `revision_requested`) has plainly
 *  started, even though its status is no longer "in progress". */
const TASK_UNDER_WAY_STATUSES = ["in_progress", "review", "rejected", "revision_requested"];

function rowsOf(result) {
  return (result && result.rows) || [];
}

/**
 * The ONE milestone authority: the matrix cell `milestones.edit`, or a Super
 * Admin. Structure and completion are the same act of authority, so both read
 * this same cell.
 *
 * Scope follows the other matrix consumers: the cell is venture-wide, so a
 * milestone-scoped assignment does not confer the right to restructure the
 * roadmap.
 */
export async function isMilestoneLeadAuthority({ code, cid, role }) {
  if (role === "super_admin") return true;
  if (!cid || !code) return false;
  try {
    return await hasVentureCapability({
      ventureId: code,
      contactId: cid,
      area: "milestones",
      action: "edit",
    });
  } catch (_) {
    return false;
  }
}

/** Resolve the VNT code of a Venture from either its code or internal UUID. */
export async function resolveVentureCode(id) {
  const result = await selectVentureIdAndCodeByIdOrCode(id).catch(() => ({ rows: [] }));
  const row = rowsOf(result)[0];
  if (!row) return null;
  return row.venture_id || (typeof id === "string" && id.startsWith("VNT-") ? id : null);
}

/**
 * Milestone STRUCTURE authority (add / remove / duplicate / reorder): the matrix
 * cell `milestones.edit`, or a Super Admin — the same cell that guards
 * completion (see isMilestoneLeadAuthority). Progress transitions are
 * deliberately NOT gated here — only structure and completion are (see the
 * milestones route).
 */
export async function canManageMilestones({ id, cid, role }) {
  if (role === "super_admin") return true;
  if (!cid) return false;
  const code = await resolveVentureCode(id);
  if (!code) return false;
  return isMilestoneLeadAuthority({ code, cid, role });
}

/**
 * Status for a newly created milestone bound to a Journey stage.
 *
 * Availability is not positional: a milestone is offered as soon as its
 * Journey is. It waits `upcoming` only while the Journey itself has not
 * started — never because another milestone happens to sit before it.
 */
export async function computeInitialMilestoneStatus({ dbId, stageId }) {
  if (!stageId) return "not_started";
  try {
    const stage = rowsOf(await selectJourneyStageStatus(stageId, dbId))[0];
    if (!stage) return "not_started";
    return stage.status === "active" ? "not_started" : MILESTONE_UPCOMING;
  } catch (_) {
    return "not_started";
  }
}

/**
 * A Journey can NEVER be closed manually. It completes automatically the
 * moment every milestone in it has been marked completed (by the Lead Manager
 * or a Super Admin).
 *
 * Completing a Journey does NOT activate the next one: Journeys start on
 * their own start_date (activateDueStages), so several can run at once.
 *
 * A journey with NO milestones never auto-completes — there is nothing to
 * close on.
 *
 * Returns { completed: false } unless the stage just closed.
 */
export async function completeStageIfAllMilestonesDone({ dbId, stageId, cid = null }) {
  if (!stageId) return { completed: false };
  try {
    const stage = rowsOf(await selectJourneyStageForCompletion(stageId, dbId).catch(() => ({ rows: [] })))[0];
    if (!stage || stage.status !== "active") return { completed: false };

    const milestonesResult = await selectLiveMilestonesForStage(dbId, stageId).catch(() =>
      selectLiveMilestonesForStagePlain(dbId, stageId).catch(() => ({ rows: [] })),
    );
    const list = rowsOf(milestonesResult);

    if (list.length === 0) return { completed: false };
    if (!list.every((milestone) => isMilestoneComplete(milestone.status))) return { completed: false };

    await completeJourneyStageRow(cid, stageId, dbId);

    // No chain: the next Journey activates on its own start_date, so nothing
    // is started from here.
    return { completed: true, stage_name: stage.name || null };
  } catch (_) {
    return { completed: false };
  }
}

/**
 * Release the milestones of an ACTIVE journey stage.
 *
 * Availability inside a Journey is not a chain: when the Journey is active,
 * every one of its HELD milestones is offered (`not_started`) EXCEPT one whose
 * explicit dependencies are unmet — that one reads `blocked` and stays blocked
 * until its prerequisites are completed. Position releases nothing; only a
 * dependency ever holds work back. Work already under way (in_progress /
 * under_review / changes_requested) and completed rows are never touched, so
 * re-running this is safe.
 *
 * Returns { released_milestone_ids } ([] when there is nothing to release).
 */
export async function releaseMilestonesForStage({ dbId, stageId }) {
  if (!stageId) return { released_milestone_ids: [] };
  try {
    const stage = rowsOf(await selectJourneyStageStatus(stageId, dbId).catch(() => ({ rows: [] })))[0];
    if (!stage || stage.status !== "active") return { released_milestone_ids: [] };

    // Held milestones of an active Journey become available unless a dependency
    // still blocks them (then they read `blocked`). Archived rows stay out of
    // the roadmap — the second statement is for databases whose schema predates
    // the is_archived column.
    const result = await releaseHeldMilestonesForStage(ARCHIVE_CLAUSE, dbId, stageId).catch(() =>
      releaseHeldMilestonesForStage("", dbId, stageId).catch(() => ({ rows: [] })),
    );
    return { released_milestone_ids: rowsOf(result)
      .filter((row) => row.status === "not_started")
      .map((row) => row.id) };
  } catch (_) {
    return { released_milestone_ids: [] };
  }
}

/**
 * The Venture-wide availability sweep — the ONLY thing that opens Journeys and
 * frees their work. Called from every read or write path that shows or changes
 * Journey state, so the roadmap is never stale. Idempotent and cheap.
 *
 * Three moves, in order:
 *   1. a HELD Journey whose own start_date has arrived becomes `active` — it
 *      never waits for another Journey to complete, so several run at once. A
 *      Journey with no start_date never auto-activates; staff start it;
 *   2. the milestones of a Journey that is NOT active read `upcoming` again
 *      (unreleased planning) — work already under way is left alone;
 *   3. the held milestones of every ACTIVE Journey are offered (`not_started`)
 *      unless an explicit dependency still blocks them — then `blocked`.
 *
 * Returns { activated_stage_ids, released_milestone_ids }.
 */
export async function activateDueStages({ dbId } = {}) {
  if (!dbId) return { activated_stage_ids: [], released_milestone_ids: [] };
  try {
    const activateResult = await activateDueJourneyStages(ARCHIVE_CLAUSE, dbId).catch(() =>
      activateDueJourneyStages("", dbId).catch(() => ({ rows: [] })),
    );
    const activated = rowsOf(activateResult).map((row) => row.id);

    // (2) A Journey that is not active holds its milestones as unreleased.
    await holdMilestonesForInactiveStages(ARCHIVE_CLAUSE, STAGE_ARCHIVE_CLAUSE, dbId).catch(() =>
      holdMilestonesForInactiveStages("", "", dbId).catch(() => ({ rows: [] })),
    );

    // (3) An active Journey offers its held milestones; a dependency may block one.
    const releaseResult = await releaseHeldMilestonesForActiveStages(ARCHIVE_CLAUSE, STAGE_ARCHIVE_CLAUSE, dbId).catch(() =>
      releaseHeldMilestonesForActiveStages("", "", dbId).catch(() => ({ rows: [] })),
    );

    return {
      activated_stage_ids: activated,
      released_milestone_ids: rowsOf(releaseResult)
        .filter((row) => row.status === "not_started")
        .map((row) => row.id),
    };
  } catch (_) {
    return { activated_stage_ids: [], released_milestone_ids: [] };
  }
}

/**
 * The unfinished milestones a milestone explicitly depends on — its blockers.
 *
 * An edge (source -> target) means the source blocks the target, so a
 * milestone's blockers are the dependency rows where it is the target and
 * the SOURCE milestone is not completed yet. Empty means nothing holds it
 * back. Ids are compared as text: milestones are UUIDs.
 */
export async function getUnmetMilestoneDependencies({ dbId, milestoneId }) {
  if (!dbId || !milestoneId) return [];
  try {
    return rowsOf(await selectUnmetDependencies(dbId, milestoneId).catch(() => ({ rows: [] })));
  } catch (_) {
    return [];
  }
}

/**
 * May a Venture-side actor book a session against this milestone?
 *
 * Any milestone of the Venture's ACTIVE Journey is bookable — availability is
 * set by the Journey and its explicit dependencies, never by a milestone's
 * position. A `locked` milestone (its Journey has not started, or a
 * dependency is unmet), a `completed` one, and one whose Journey is finished
 * are refused. Staff (Lead Manager, coach, Super Admin) are not restricted by
 * this — they plan ahead.
 *
 * A refusal always carries a REASON the Venture can read, so nobody is left
 * guessing why their booking was rejected: the reason names the actual state
 * (locked / not started / already completed / a finished Journey).
 *
 * Returns { ok: true, milestone } or { ok: false, reason }.
 */
export async function assertBookableMilestone({ dbId, milestoneId }) {
  try {
    const milestonesResult = await selectMilestoneForBooking(milestoneId, dbId).catch(() =>
      selectMilestoneForBookingPlain(milestoneId, dbId).catch(() => ({ rows: [] })),
    );
    const milestone = rowsOf(milestonesResult)[0];
    if (!milestone) {
      return { ok: false, reason: "This milestone no longer exists for this Venture." };
    }
    if (milestone.is_archived === true) {
      return { ok: false, reason: "This milestone has been archived, so it is no longer part of the Journey." };
    }
    if (isMilestoneComplete(milestone.status)) {
      return { ok: false, reason: "This milestone is already completed." };
    }
    if (milestone.status === MILESTONE_UPCOMING || milestone.status === "locked") {
      return { ok: false, reason: "This milestone is still upcoming. It opens once its Journey is under way." };
    }
    if (milestone.status === MILESTONE_BLOCKED) {
      return { ok: false, reason: "This milestone is blocked by a dependency that is not completed yet." };
    }

    // The milestone must belong to the Journey that is actually current.
    const stage = rowsOf(await selectJourneyStageForBooking(milestone.journey_stage_id, dbId).catch(() => ({ rows: [] })))[0];
    if (!stage) {
      return { ok: false, reason: "This milestone is not part of a Journey, so no session can be booked against it." };
    }
    if (stage.status === MILESTONE_UPCOMING || stage.status === "locked") {
      return { ok: false, reason: `The Journey "${stage.name}" has not started yet.` };
    }
    if (stage.status !== "active") {
      return { ok: false, reason: `The Journey "${stage.name}" is finished, so its milestones take no new sessions.` };
    }

    // Blocked only by an explicit dependency: a milestone it depends on that
    // is not completed yet refuses the booking BY NAME.
    const blockers = await getUnmetMilestoneDependencies({ dbId, milestoneId: milestone.id });
    if (blockers.length > 0) {
      const names = blockers.map((blocker) => `"${blocker.title || "an earlier milestone"}"`).join(", ");
      return { ok: false, reason: `This milestone depends on ${names}, which is not completed yet.` };
    }

    return { ok: true, milestone };
  } catch (_) {
    // Fail closed: an unresolvable chain is not a reason to allow the booking.
    return { ok: false, reason: "Your milestone progression could not be verified, so the session was not booked." };
  }
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
