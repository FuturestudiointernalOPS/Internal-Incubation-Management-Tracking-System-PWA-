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

export default { isMilestoneLeadAuthority, computeInitialMilestoneStatus, completeMilestoneAndUnlockNext };
