/**
 * Journey stage ARCHIVE + permanent DELETE engine (Vinance 3 — Super Admin).
 *
 *   - Archive is a SOFT delete: the journey stays in the database (with its
 *     milestones/tasks/notes) and can be restored from the Archived view.
 *   - Permanent DELETE removes the journey row AND its bound structure
 *     (milestones + their tasks) — but ONLY when nothing has been filed
 *     (no task submissions, task reviews or milestone deliverables anywhere
 *     in that journey). Anything with filed work is blocked and must be
 *     archived instead: it is part of the Venture's record.
 *
 * The UI requires a DOUBLE confirmation before either action.
 */

import { milestoneHasFiledWork } from "@/lib/ventureArchive";

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** Milestone ids bound to one journey stage. */
async function stageMilestoneIds(db, { dbId, stageId }) {
  const r = await db
    .execute({
      sql: "SELECT id FROM venture_milestones WHERE venture_id = ? AND journey_stage_id = ?",
      args: [dbId, String(stageId)],
    })
    .catch(() => ({ rows: [] }));
  return rowsOf(r).map((m) => m.id);
}

/** True when the stage's journey has any filed work (submissions/reviews/deliverables). */
export async function stageHasFiledWork(db, { dbId, stageId }) {
  const milestoneIds = await stageMilestoneIds(db, { dbId, stageId });
  for (const mid of milestoneIds) {
    if (await milestoneHasFiledWork(db, mid)) return true;
  }
  return false;
}

/**
 * Archive/restore a set of journey stages. Archive NEVER fails on filed work
 * (that is exactly what archive is for); it only hides the journey.
 * Returns { archived: [...], restored: [...], blocked: [...] }.
 */
export async function archiveJourneyStages(db, { dbId, stageIds = [], actorCid = null }) {
  const archived = [];
  const restored = [];
  const blocked = [];
  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const exists = await db.execute({
        sql: "SELECT id, name FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
        args: [id, dbId],
      });
      const row = rowsOf(exists)[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      await db.execute({
        sql: `UPDATE venture_journey_stages
              SET is_archived = TRUE, archived_at = COALESCE(archived_at, NOW()), archived_by = COALESCE(archived_by, ?)
              WHERE id = ? AND venture_id = ?`,
        args: [actorCid, id, dbId],
      });
      archived.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not archive this journey." });
    }
  }
  return { archived, restored, blocked };
}

export async function restoreJourneyStages(db, { dbId, stageIds = [] }) {
  const restored = [];
  const blocked = [];
  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const exists = await db.execute({
        sql: "SELECT id, name FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
        args: [id, dbId],
      });
      const row = rowsOf(exists)[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      await db.execute({
        sql: `UPDATE venture_journey_stages
              SET is_archived = FALSE, archived_at = NULL, archived_by = NULL
              WHERE id = ? AND venture_id = ?`,
        args: [id, dbId],
      });
      restored.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not restore this journey." });
    }
  }
  return { archived: [], restored, blocked };
}

/** Re-serialize stage_order (1..n) for every remaining stage of the Venture. */
async function renumberStages(db, dbId) {
  const r = await db.execute({
    sql: "SELECT id FROM venture_journey_stages WHERE venture_id = ? ORDER BY stage_order ASC",
    args: [dbId],
  });
  const rows = rowsOf(r);
  for (let i = 0; i < rows.length; i += 1) {
    await db.execute({
      sql: "UPDATE venture_journey_stages SET stage_order = ? WHERE id = ?",
      args: [i + 1, rows[i].id],
    });
  }
}

/**
 * Permanently delete journey stages (and their clean milestone/task
 * structure). Journeys with filed work are blocked — archive them instead.
 * Returns { deleted: [...], blocked: [{ id, title, reason }] }.
 */
export async function deleteJourneyStages(db, { dbId, stageIds = [] }) {
  const deleted = [];
  const blocked = [];

  for (const rawId of stageIds) {
    const id = String(rawId);
    try {
      const exists = await db.execute({
        sql: "SELECT id, name FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
        args: [id, dbId],
      });
      const row = rowsOf(exists)[0];
      if (!row) {
        blocked.push({ id, title: id, reason: "Journey not found." });
        continue;
      }
      if (await stageHasFiledWork(db, { dbId, stageId: id })) {
        blocked.push({
          id,
          title: row.name || id,
          reason: "This journey already has submitted work — it cannot be permanently deleted. Archive it instead.",
        });
        continue;
      }

      const milestoneIds = await stageMilestoneIds(db, { dbId, stageId: id });

      // Best-effort cleanup of optional child rows (outside the core
      // transaction so a missing legacy table can never abort the delete).
      for (const mid of milestoneIds) {
        const taskRows = await db
          .execute({
            sql: "SELECT id FROM venture_tasks WHERE milestone_id = ?",
            args: [String(mid)],
          })
          .catch(() => ({ rows: [] }));
        for (const t of rowsOf(taskRows)) {
          await db.execute({ sql: "DELETE FROM venture_task_reviews WHERE task_id = ?", args: [t.id] }).catch(() => {});
          await db.execute({ sql: "DELETE FROM venture_task_comments WHERE task_id = ?", args: [t.id] }).catch(() => {});
          await db.execute({ sql: "DELETE FROM venture_task_attachments WHERE task_id = ?", args: [t.id] }).catch(() => {});
        }
      }
      await db
        .execute({ sql: "DELETE FROM venture_notes WHERE scope_ref_type = 'journey_stage' AND scope_ref_id = ?", args: [id] })
        .catch(() => {});

      await db.transaction(async (query) => {
        for (const mid of milestoneIds) {
          await query("DELETE FROM venture_deliverables WHERE milestone_id = ?", [String(mid)]);
          await query("DELETE FROM venture_tasks WHERE milestone_id = ?", [String(mid)]);
          await query("DELETE FROM venture_milestones WHERE id = ? AND venture_id = ?", [String(mid), dbId]);
        }
        await query("DELETE FROM venture_journey_stages WHERE id = ? AND venture_id = ?", [id, dbId]);
      });

      deleted.push({ id, title: row.name || id });
    } catch (_) {
      blocked.push({ id, title: id, reason: "Could not delete this journey." });
    }
  }

  if (deleted.length > 0) {
    await renumberStages(db, dbId).catch(() => {});
  }
  return { deleted, blocked };
}

export default { stageHasFiledWork, archiveJourneyStages, restoreJourneyStages, deleteJourneyStages };
