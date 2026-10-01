/**
 * services/ventures/journeyStageActions — what a Journey (stage) management
 * action does, and the history it leaves.
 *
 * Moved verbatim out of `src/app/api/ventures/[id]/journey/route.js` (PATCH,
 * lane L2). The controller keeps the session, the operating_plan gates
 * (edit / manage), the stage lookup and every response; this module runs the
 * transition and writes the change log. A refusal is answered as
 * `{ error, status }` with the exact former message and status.
 *
 * Same facades as the controller used, so route-level test mocks still apply.
 * No SQL, no HTTP.
 */
import { releaseMilestonesForStage } from "@/lib/ventureMilestoneEngine";
import { moveJourneyStage, deleteJourneyStage, nextJourneyStageOrder } from "@/lib/ventureJourneys";
import { diffFields, recordVentureChange } from "@/models/ventureChangeLog";
import {
  countJourneyStagesByVenture,
  insertJourneyStage,
  activateJourneyStage,
  lockJourneyStage,
  holdJourneyStageMilestones,
  resetJourneyStage,
} from "@/models/ventureJourney";

/**
 * Adds a Journey (stage) to the Venture: the first one starts active, the
 * others upcoming; it goes last in the order; dates are cut to YYYY-MM-DD.
 * The history row is best-effort.
 *
 * @returns {Promise<{ error: string, status: number } | { insertResult: object }>}
 */
export async function addJourneyStage({ ventureParam, dbId, body }) {
  const name = String(body.name || "").trim();
  if (!name) return { error: "name is required.", status: 400 };

  const existing = await countJourneyStagesByVenture(dbId);
  const count = Number(existing.rows?.[0]?.n || 0);
  const stageOrder = await nextJourneyStageOrder(dbId);
  const status = count === 0 ? "active" : "upcoming";
  const targetDate = body.target_date ? String(body.target_date).slice(0, 10) : null;
  // Optional: when the Journey starts on its own (NULL = it starts only when
  // a staff member activates it). No ordering is imposed on it.
  const startDate = body.start_date ? String(body.start_date).slice(0, 10) : null;

  const insertResult = await insertJourneyStage({
    ventureId: dbId, name, description: body.description || null, objective: body.objective || null,
    startDate, targetDate, stageOrder, status,
  });

  try {
    const { addVentureHistory } = await import("@/lib/ventures");
    await addVentureHistory({ venture_id: ventureParam, event_type: "JOURNEY_STAGE_ADDED", description: `Journey stage "${name}" added` });
  } catch (_) {}
  return { insertResult };
}

/**
 * Field-level history of a stage edit. Non-fatal by contract — the write
 * already succeeded and must not be undone by a logging failure.
 */
export async function recordJourneyStageEdit({ dbId, stage, stageId, name, body, session }) {
  // Field-level history of the edit. Non-fatal by contract — the write above
  // already succeeded and must not be undone by a logging failure.
  try {
    const JOURNEY_FIELDS = ["name", "description", "objective", "target_date", "start_date"];
    const journeyChanges = diffFields(stage, body, JOURNEY_FIELDS);
    if (journeyChanges.length) {
      await recordVentureChange({
        dbId,
        entityType: "journey",
        entityId: stageId,
        entityLabel: stage.name || name || null,
        action: "updated",
        actorCid: session?.cid || null,
        actorName: session?.name || null,
        changes: journeyChanges,
      });
    }
  } catch (_) {}
}

/**
 * Runs one management transition on a stage the controller already looked up
 * (`stage` may be null when no stage_id was given).
 *
 * @returns {Promise<null | { error: string, status: number }>} null = done
 */
export async function runJourneyStageTransition({ action, stage, stageId, dbId, body }) {
  if (action === "activate") {
    if (!stage) return { error: "Stage not found", status: 404 };
    if (stage.status === "completed") {
      return { error: "Completed stages are not reactivated directly — reset the stage first.", status: 400 };
    }
    // Activating is additive: Journeys overlap, so the others are left
    // alone (locking them here would fight the date-driven sweep, which
    // re-activates any Journey whose start_date has arrived).
    await activateJourneyStage(stageId, dbId);
    // The journey is now active — its milestones are offered (availability
    // is set by the Journey, never by a milestone's position).
    await releaseMilestonesForStage({ dbId, stageId });
  } else if (action === "lock") {
    if (!stage) return { error: "Stage not found", status: 404 };
    if (stage.status === "completed") {
      return { error: "Completed stages cannot be paused — reset the stage first.", status: 400 };
    }
    await lockJourneyStage(stageId, dbId);
    // A Journey that is no longer active holds its unreleased work again.
    // Work already under way is left where it is.
    await holdJourneyStageMilestones(dbId, stageId);
  } else if (action === "complete") {
    // A journey is NEVER closed by hand: it completes automatically once all
    // of its milestones have been marked completed.
    return { error: "A journey cannot be closed manually — it completes automatically once all of its milestones are completed.", status: 400 };
  } else if (action === "reset") {
    if (!stage) return { error: "Stage not found", status: 404 };
    // Reopening touches THIS Journey only. Journeys overlap, so what the
    // others are is decided by their own dates (and by staff), never by a
    // neighbour's state — the old positional re-lock is gone.
    await resetJourneyStage(stageId, dbId);
    // Reopened journey is active again — its milestones are offered.
    await releaseMilestonesForStage({ dbId, stageId });
  } else if (action === "delete") {
    if (!stage) return { error: "Stage not found", status: 404 };
    await deleteJourneyStage({ dbId, stageId });
  } else if (action === "move") {
    if (!stage) return { error: "Stage not found", status: 404 };
    const direction = String(body.direction || "");
    if (!["up", "down"].includes(direction)) {
      return { error: "direction (up|down) is required.", status: 400 };
    }
    const moved = await moveJourneyStage({ dbId, stageId, direction });
    if (moved.error) return { error: moved.error, status: 400 };
  }
  return null;
}

/**
 * The transition itself is the change. Called after the gate, so a refused
 * action never leaves a row claiming it happened. Non-fatal.
 */
export async function recordJourneyStageTransition({ action, stage, stageId, dbId, body, session }) {
  // The transition itself is the change. Recorded after the gate above, so a
  // refused action never leaves a row claiming it happened.
  try {
    const ACTION_NAMES = { activate: "activated", lock: "locked", reset: "reopened", delete: "deleted", move: "moved" };
    const actionName = ACTION_NAMES[action];
    if (actionName) {
      const nextStatus =
        action === "activate" ? "active" : action === "lock" ? "upcoming" : action === "reset" ? "active" : null;
      const changes =
        nextStatus && stage?.status && stage.status !== nextStatus
          ? [{ field: "status", from: stage.status, to: nextStatus }]
          : [];
      await recordVentureChange({
        dbId,
        entityType: "journey",
        entityId: stageId,
        entityLabel: stage?.name || null,
        action: actionName,
        actorCid: session?.cid || null,
        actorName: session?.name || null,
        changes,
        metadata: action === "move" ? { direction: String(body.direction || "") } : null,
      });
    }
  } catch (_) {}
}
