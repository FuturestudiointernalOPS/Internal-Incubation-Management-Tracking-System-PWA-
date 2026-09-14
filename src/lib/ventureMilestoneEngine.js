/**
 * Milestone progression engine (Vinance 3 — Phase 3, doc §12).
 *
 * Sequential gating inside each Journey stage:
 *   - the FIRST milestone of a stage starts available ('not_started');
 *   - every following milestone starts 'locked';
 *   - a milestone may ONLY be marked completed by the Venture's assigned
 *     Lead Manager (active lead_manager assignment) or a Super Admin;
 *   - completion automatically unlocks the next locked milestone in the
 *     same stage (first by display_order).
 *
 * Founders never see locked milestones (journey API filters them), so
 * unreleased work is invisible until the manager/coach progression reaches
 * it. Manual overrides by authorized actors are recorded through the normal
 * history/notification events.
 */

import { isMilestoneComplete } from "@/lib/ventureStatuses";

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** Lead Manager (active assignment) or Super Admin — the ONLY completion authority. */
export async function isMilestoneLeadAuthority(db, { code, cid, role }) {
  if (role === "super_admin") return true;
  if (!cid) return false;
  try {
    const r = await db.execute({
      sql: `SELECT 1 FROM venture_staff_assignments
            WHERE venture_id = ? AND staff_contact_id = ?
              AND responsibility_code = 'lead_manager' AND status = 'active'
            LIMIT 1`,
      args: [code, cid],
    });
    return (rowsOf(r).length || 0) > 0;
  } catch (_) {
    return false;
  }
}

/** Resolve the VNT code of a Venture from either its code or internal UUID. */
export async function resolveVentureCode(db, id) {
  const r = await db
    .execute({
      sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?",
      args: [id, id],
    })
    .catch(() => ({ rows: [] }));
  const row = rowsOf(r)[0];
  if (!row) return null;
  return row.venture_id || (typeof id === "string" && id.startsWith("VNT-") ? id : null);
}

/**
 * Milestone STRUCTURE authority (add / remove / duplicate / reorder): the
 * Venture's assigned Lead Manager or a Super Admin. Progress transitions are
 * deliberately NOT gated here — only completion is (see the milestones route).
 */
export async function canManageMilestones(db, { id, cid, role }) {
  if (role === "super_admin") return true;
  if (!cid) return false;
  const code = await resolveVentureCode(db, id);
  if (!code) return false;
  return isMilestoneLeadAuthority(db, { code, cid, role });
}

/**
 * Status for a newly created milestone bound to a Journey stage:
 * not_started when it is the stage's first milestone or the previous one is
 * completed; otherwise locked (sequential release).
 */
export async function computeInitialMilestoneStatus(db, { dbId, stageId }) {
  if (!stageId) return "not_started";
  try {
    const r = await db.execute({
      sql: `SELECT status FROM venture_milestones
            WHERE venture_id = ? AND journey_stage_id = ?
            ORDER BY COALESCE(display_order, 0) DESC, created_at DESC
            LIMIT 1`,
      args: [dbId, stageId],
    });
    const last = rowsOf(r)[0];
    if (!last) return "not_started";
    return isMilestoneComplete(last.status) ? "not_started" : "locked";
  } catch (_) {
    return "not_started";
  }
}

/**
 * A Journey can NEVER be closed manually. It completes automatically the
 * moment every milestone in it has been marked completed (by the Lead Manager
 * or a Super Admin), and that completion activates the next journey and
 * releases its first milestone.
 *
 * A journey with NO milestones never auto-completes — there is nothing to
 * close on.
 *
 * Returns { completed: false } unless the stage just closed.
 */
export async function completeStageIfAllMilestonesDone(db, { dbId, stageId, cid = null }) {
  if (!stageId) return { completed: false };
  try {
    const stageRes = await db
      .execute({
        sql: "SELECT id, name, status, stage_order FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
        args: [String(stageId), dbId],
      })
      .catch(() => ({ rows: [] }));
    const stage = rowsOf(stageRes)[0];
    if (!stage || stage.status !== "active") return { completed: false };

    const richSql = `SELECT id, status FROM venture_milestones
                     WHERE venture_id = ? AND journey_stage_id = ? AND COALESCE(is_archived, FALSE) = FALSE`;
    const plainSql = `SELECT id, status FROM venture_milestones WHERE venture_id = ? AND journey_stage_id = ?`;
    const msRes = await db
      .execute({ sql: richSql, args: [dbId, String(stageId)] })
      .catch(() => db.execute({ sql: plainSql, args: [dbId, String(stageId)] }).catch(() => ({ rows: [] })));
    const list = rowsOf(msRes);

    if (list.length === 0) return { completed: false };
    if (!list.every((m) => isMilestoneComplete(m.status))) return { completed: false };

    await db.execute({
      sql: "UPDATE venture_journey_stages SET status = 'completed', completed_at = NOW(), approved_by = ? WHERE id = ? AND venture_id = ?",
      args: [cid, String(stageId), dbId],
    });

    // The next journey becomes current, and its first milestone is released.
    const nextRes = await db
      .execute({
        sql: "SELECT id FROM venture_journey_stages WHERE venture_id = ? AND stage_order = ? AND status = 'locked'",
        args: [dbId, stage.stage_order + 1],
      })
      .catch(() => ({ rows: [] }));
    const nextStageId = rowsOf(nextRes)[0]?.id || null;
    if (nextStageId) {
      await db.execute({
        sql: "UPDATE venture_journey_stages SET status = 'active' WHERE id = ? AND venture_id = ?",
        args: [String(nextStageId), dbId],
      });
      await releaseFirstMilestoneForStage(db, { dbId, stageId: nextStageId });
    }

    return { completed: true, stage_name: stage.name || null, next_stage_id: nextStageId };
  } catch (_) {
    return { completed: false };
  }
}

/**
 * Release the first unfinished milestone of an ACTIVE journey stage.
 *
 * The chain is: the first milestone (by display order) that is not completed
 * becomes available (locked -> not_started). Everything after it stays locked,
 * and nothing is ever locked back or un-completed — so re-running this is safe.
 * Returns { released_milestone_id } (null when there is nothing to release).
 */
export async function releaseFirstMilestoneForStage(db, { dbId, stageId }) {
  if (!stageId) return { released_milestone_id: null };
  try {
    const stageRes = await db.execute({
      sql: "SELECT status FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
      args: [String(stageId), dbId],
    }).catch(() => ({ rows: [] }));
    const stage = rowsOf(stageRes)[0];
    if (!stage || stage.status !== "active") return { released_milestone_id: null };

    // Archived milestones are not part of the chain (guarded for databases
    // whose schema predates the is_archived column).
    const richSql = `SELECT id, status FROM venture_milestones
                     WHERE venture_id = ? AND journey_stage_id = ? AND COALESCE(is_archived, FALSE) = FALSE
                     ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`;
    const plainSql = `SELECT id, status FROM venture_milestones
                      WHERE venture_id = ? AND journey_stage_id = ?
                      ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`;
    const msRes = await db
      .execute({ sql: richSql, args: [dbId, String(stageId)] })
      .catch(() => db.execute({ sql: plainSql, args: [dbId, String(stageId)] }).catch(() => ({ rows: [] })));
    const list = rowsOf(msRes);

    const firstOpen = list.find((m) => !isMilestoneComplete(m.status));
    if (!firstOpen || firstOpen.status !== "locked") return { released_milestone_id: null };

    await db.execute({
      sql: "UPDATE venture_milestones SET status = 'not_started', updated_at = NOW() WHERE id = ? AND status = 'locked'",
      args: [firstOpen.id],
    });
    return { released_milestone_id: firstOpen.id };
  } catch (_) {
    return { released_milestone_id: null };
  }
}

/**
 * Mark a milestone completed and unlock the next locked milestone in the
 * same stage. Returns { unlocked_milestone_id } (null when none follows).
 * Assumes the caller already verified completion authority.
 */
export async function completeMilestoneAndUnlockNext(db, { dbId, milestoneId }) {
  const milestoneRes = await db.execute({
    sql: `SELECT id, journey_stage_id FROM venture_milestones WHERE id = ? AND venture_id = ?`,
    args: [milestoneId, dbId],
  });
  const milestone = rowsOf(milestoneRes)[0];
  if (!milestone) return { error: "Milestone not found." };

  await db.execute({
    sql: "UPDATE venture_milestones SET status = 'completed', progress = 100, updated_at = NOW() WHERE id = ?",
    args: [milestoneId],
  });

  if (!milestone.journey_stage_id) return { unlocked_milestone_id: null };

  const nextRes = await db.execute({
    sql: `SELECT id FROM venture_milestones
          WHERE venture_id = ? AND journey_stage_id = ? AND status = 'locked'
          ORDER BY COALESCE(display_order, 0), created_at ASC
          LIMIT 1`,
    args: [dbId, milestone.journey_stage_id],
  });
  const next = rowsOf(nextRes)[0];
  if (!next) return { unlocked_milestone_id: null };

  await db.execute({
    sql: "UPDATE venture_milestones SET status = 'not_started', updated_at = NOW() WHERE id = ?",
    args: [next.id],
  });
  return { unlocked_milestone_id: next.id };
}

export default { isMilestoneLeadAuthority, resolveVentureCode, canManageMilestones, computeInitialMilestoneStatus, releaseFirstMilestoneForStage, completeStageIfAllMilestonesDone, completeMilestoneAndUnlockNext };
