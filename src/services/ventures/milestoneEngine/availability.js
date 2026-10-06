/**
 * milestoneEngine — When milestones and journeys become available: initial status, date-driven activation, release, dependencies, bookability, automatic journey close.
 *
 * Part of `services/ventures/milestoneEngine` (split out of the former single
 * 548-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/milestoneEngine.js`.
 */
import { MILESTONE_BLOCKED, MILESTONE_UPCOMING, isMilestoneComplete } from "@/lib/ventureStatuses";
import {
  ARCHIVE_CLAUSE,
  STAGE_ARCHIVE_CLAUSE,
  activateDueJourneyStages,
  completeJourneyStageRow,
  holdMilestonesForInactiveStages,
  releaseHeldMilestonesForActiveStages,
  releaseHeldMilestonesForStage,
  selectJourneyStageForBooking,
  selectJourneyStageForCompletion,
  selectJourneyStageStatus,
  selectLiveMilestonesForStage,
  selectLiveMilestonesForStagePlain,
  selectMilestoneForBooking,
  selectMilestoneForBookingPlain,
  selectUnmetDependencies,
} from "@/models/ventureMilestoneEngineStore";
import { rowsOf } from "./status";

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
