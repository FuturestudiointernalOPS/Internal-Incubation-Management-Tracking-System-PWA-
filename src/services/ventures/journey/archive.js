/**
 * journey — Archive, restore and permanent delete of journey stages.
 *
 * Part of `services/ventures/journey` (split out of the former single
 * 520-line module, lane L2; code moved verbatim). The public surface is
 * re-exported unchanged by `src/services/ventures/journey.js`.
 */
import {
  archiveJourneyStageRow,
  deleteDeliverablesForMilestone,
  deleteJourneyStageNotes,
  deleteJourneyStageRow,
  deleteMilestoneRow,
  deleteTaskAttachmentsForTask,
  deleteTaskCommentsForTask,
  deleteTaskReviewsForTask,
  deleteTasksForMilestone,
  restoreJourneyStageRow,
  runInTransaction,
  selectJourneyStageForArchive,
  selectJourneyStageIdsOrdered,
  selectMilestoneTaskIds,
  selectStageMilestoneIds,
  updateJourneyStageOrder,
} from "@/models/ventureJourneyStore";
// The filed-work guard is the archive engine's decision — reused, never copied.
import { milestoneHasFiledWork } from "@/services/ventures/archive";
import { rowsOf } from "./stages";

// ── Archive / permanent delete ───────────────────────────────────────────────

/** Milestone ids bound to one journey stage. */
async function stageMilestoneIds({ dbId, stageId }) {
  const result = await selectStageMilestoneIds(dbId, stageId).catch(() => ({ rows: [] }));
  return rowsOf(result).map((milestone) => milestone.id);
}

/** True when the stage's journey has any filed work (submissions/reviews/deliverables). */
export async function stageHasFiledWork({ dbId, stageId }) {
  const milestoneIds = await stageMilestoneIds({ dbId, stageId });
  for (const milestoneId of milestoneIds) {
    if (await milestoneHasFiledWork(milestoneId)) return true;
  }
  return false;
}

/**
 * Archive/restore a set of journey stages. Archive NEVER fails on filed work
 * (that is exactly what archive is for); it only hides the journey.
 * Returns { archived: [...], restored: [...], blocked: [...] }.
 */
export async function archiveJourneyStages({ dbId, stageIds = [], actorCid = null }) {
  const archived = [];
  const restored = [];
  const blocked = [];
  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const row = rowsOf(await selectJourneyStageForArchive(dbId, id))[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      await archiveJourneyStageRow(actorCid, id, dbId);
      archived.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not archive this journey." });
    }
  }
  return { archived, restored, blocked };
}

export async function restoreJourneyStages({ dbId, stageIds = [] }) {
  const restored = [];
  const blocked = [];
  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const row = rowsOf(await selectJourneyStageForArchive(dbId, id))[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      await restoreJourneyStageRow(id, dbId);
      restored.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not restore this journey." });
    }
  }
  return { archived: [], restored, blocked };
}

/** Re-serialize stage_order (1..n) for every remaining stage of the Venture. */
async function renumberStages(dbId) {
  const rows = rowsOf(await selectJourneyStageIdsOrdered(dbId));
  for (let i = 0; i < rows.length; i += 1) {
    await updateJourneyStageOrder(i + 1, rows[i].id);
  }
}

/**
 * Permanently delete journey stages (and their clean milestone/task
 * structure). Journeys with filed work are blocked — archive them instead.
 * Returns { deleted: [...], blocked: [{ id, title, reason }] }.
 */
export async function deleteJourneyStages({ dbId, stageIds = [] }) {
  const deleted = [];
  const blocked = [];

  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const row = rowsOf(await selectJourneyStageForArchive(dbId, id))[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      if (await stageHasFiledWork({ dbId, stageId: id })) {
        blocked.push({
          id,
          title: row.name || id,
          reason: "This journey already has submitted work — it cannot be permanently deleted. Archive it instead.",
        });
        continue;
      }

      const milestoneIds = await stageMilestoneIds({ dbId, stageId: id });

      // Best-effort cleanup of optional child rows (outside the core
      // transaction so a missing legacy table can never abort the delete).
      for (const milestoneId of milestoneIds) {
        const taskRows = await selectMilestoneTaskIds(milestoneId).catch(() => ({ rows: [] }));
        for (const task of rowsOf(taskRows)) {
          await deleteTaskReviewsForTask(task.id).catch(() => {});
          await deleteTaskCommentsForTask(task.id).catch(() => {});
          await deleteTaskAttachmentsForTask(task.id).catch(() => {});
        }
      }
      await deleteJourneyStageNotes(id).catch(() => {});

      await runInTransaction(async (query) => {
        for (const milestoneId of milestoneIds) {
          await deleteDeliverablesForMilestone(query, milestoneId);
          await deleteTasksForMilestone(query, milestoneId);
          await deleteMilestoneRow(query, milestoneId, dbId);
        }
        await deleteJourneyStageRow(query, id, dbId);
      });

      deleted.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not delete this journey." });
    }
  }

  if (deleted.length > 0) {
    await renumberStages(dbId).catch(() => {});
  }
  return { deleted, blocked };
}
