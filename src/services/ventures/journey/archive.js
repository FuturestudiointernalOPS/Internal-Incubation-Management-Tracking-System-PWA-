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
import { filedWorkPhrase, milestoneFiledWorkKinds } from "@/services/ventures/archive";
import { rowsOf } from "./stages";

// ── Archive / permanent delete ───────────────────────────────────────────────

/** Milestone ids bound to one journey stage. */
async function stageMilestoneIds({ dbId, stageId }) {
  const result = await selectStageMilestoneIds(dbId, stageId).catch(() => ({ rows: [] }));
  return rowsOf(result).map((milestone) => milestone.id);
}

/** The KINDS of filed work a journey stage holds, across its milestones. */
export async function stageFiledWorkKinds({ dbId, stageId }) {
  const kinds = { deliverables: false, submissions: false, reviews: false };
  const milestoneIds = await stageMilestoneIds({ dbId, stageId });
  for (const milestoneId of milestoneIds) {
    const found = await milestoneFiledWorkKinds(milestoneId);
    kinds.deliverables = kinds.deliverables || found.deliverables;
    kinds.submissions = kinds.submissions || found.submissions;
    kinds.reviews = kinds.reviews || found.reviews;
  }
  return kinds;
}

/** True when the stage's journey has any filed work — see stageFiledWorkKinds. */
export async function stageHasFiledWork({ dbId, stageId }) {
  const kinds = await stageFiledWorkKinds({ dbId, stageId });
  return kinds.deliverables || kinds.submissions || kinds.reviews;
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
 * Permanently delete journey stages (and their milestone/task structure).
 * Journeys with filed work are blocked — archive them instead. A pristine
 * deliverable row (a tracker-import artifact) is NOT filed work: it belongs to
 * the plan and is deleted with it.
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
      const filed = await stageFiledWorkKinds({ dbId, stageId: id });
      if (filed.deliverables || filed.submissions || filed.reviews) {
        blocked.push({
          id,
          title: row.name || id,
          // Says WHAT blocks it — "submitted work" alone sent people looking
          // for submissions that were never made.
          reason: `This journey contains ${filedWorkPhrase(filed)} — it cannot be permanently deleted. Archive it instead.`,
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
