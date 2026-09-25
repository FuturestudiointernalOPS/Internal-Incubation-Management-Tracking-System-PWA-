/**
 * Milestone progression engine (Vinance 3 — Phase 3, doc §12).
 *
 * Sequential gating inside each Journey stage:
 *   - the FIRST milestone of a stage starts available ('not_started');
 *   - every following milestone starts 'locked';
 *   - a milestone may ONLY be created, restructured or marked completed by a
 *     holder of the permission matrix cell `milestones.edit` — which the seeded
 *     Lead Manager holds and a Coach does not — or by a Super Admin;
 *   - completion automatically unlocks the next locked milestone in the
 *     same stage (first by display_order).
 *
 * Authority is read from the matrix and nowhere else. It used to be decided here
 * by querying `venture_staff_assignments` for a `lead_manager` responsibility —
 * a SECOND answer to a question the matrix already answered. Two answers is how
 * a Coach could rewrite a milestone while the matrix said they could not.
 *
 * Founders never see locked milestones (journey API filters them), so
 * unreleased work is invisible until the manager/coach progression reaches
 * it. Manual overrides by authorized actors are recorded through the normal
 * history/notification events.
 */

import { isMilestoneComplete } from "@/lib/ventureStatuses";
import { hasVentureCapability } from "@/lib/venturePermissions";

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
export async function isMilestoneLeadAuthority(db, { code, cid, role }) {
  if (role === "super_admin") return true;
  if (!cid || !code) return false;
  try {
    return await hasVentureCapability(db, {
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
export async function resolveVentureCode(db, id) {
  const result = await db
    .execute({
      sql: "SELECT id, venture_id FROM ventures WHERE venture_id = ? OR id::text = ?",
      args: [id, id],
    })
    .catch(() => ({ rows: [] }));
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
    const result = await db.execute({
      sql: `SELECT status FROM venture_milestones
            WHERE venture_id = ? AND journey_stage_id = ?
            ORDER BY COALESCE(display_order, 0) DESC, created_at DESC
            LIMIT 1`,
      args: [dbId, stageId],
    });
    const last = rowsOf(result)[0];
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
    const stageResult = await db
      .execute({
        sql: "SELECT id, name, status, stage_order FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
        args: [String(stageId), dbId],
      })
      .catch(() => ({ rows: [] }));
    const stage = rowsOf(stageResult)[0];
    if (!stage || stage.status !== "active") return { completed: false };

    const richSql = `SELECT id, status FROM venture_milestones
                     WHERE venture_id = ? AND journey_stage_id = ? AND COALESCE(is_archived, FALSE) = FALSE`;
    const plainSql = `SELECT id, status FROM venture_milestones WHERE venture_id = ? AND journey_stage_id = ?`;
    const milestonesResult = await db
      .execute({ sql: richSql, args: [dbId, String(stageId)] })
      .catch(() => db.execute({ sql: plainSql, args: [dbId, String(stageId)] }).catch(() => ({ rows: [] })));
    const list = rowsOf(milestonesResult);

    if (list.length === 0) return { completed: false };
    if (!list.every((milestone) => isMilestoneComplete(milestone.status))) return { completed: false };

    await db.execute({
      sql: "UPDATE venture_journey_stages SET status = 'completed', completed_at = NOW(), approved_by = ? WHERE id = ? AND venture_id = ?",
      args: [cid, String(stageId), dbId],
    });

    // The next journey becomes current, and its first milestone is released.
    const nextStageResult = await db
      .execute({
        sql: "SELECT id FROM venture_journey_stages WHERE venture_id = ? AND stage_order = ? AND status = 'locked'",
        args: [dbId, stage.stage_order + 1],
      })
      .catch(() => ({ rows: [] }));
    const nextStageId = rowsOf(nextStageResult)[0]?.id || null;
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
    const stageResult = await db.execute({
      sql: "SELECT status FROM venture_journey_stages WHERE id = ? AND venture_id = ?",
      args: [String(stageId), dbId],
    }).catch(() => ({ rows: [] }));
    const stage = rowsOf(stageResult)[0];
    if (!stage || stage.status !== "active") return { released_milestone_id: null };

    // Archived milestones are not part of the chain (guarded for databases
    // whose schema predates the is_archived column).
    const richSql = `SELECT id, status FROM venture_milestones
                     WHERE venture_id = ? AND journey_stage_id = ? AND COALESCE(is_archived, FALSE) = FALSE
                     ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`;
    const plainSql = `SELECT id, status FROM venture_milestones
                      WHERE venture_id = ? AND journey_stage_id = ?
                      ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`;
    const milestonesResult = await db
      .execute({ sql: richSql, args: [dbId, String(stageId)] })
      .catch(() => db.execute({ sql: plainSql, args: [dbId, String(stageId)] }).catch(() => ({ rows: [] })));
    const list = rowsOf(milestonesResult);

    const firstOpen = list.find((milestone) => !isMilestoneComplete(milestone.status));
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
 * May a Venture-side actor book a session against this milestone?
 *
 * STRICTLY the Venture's CURRENT milestone — the single one the chain has
 * released. The chain releases exactly one milestone per active Journey: the
 * first non-archived, non-completed one by display order; everything after it
 * stays 'locked' and is never shown to the Venture. Staff (Lead Manager, coach,
 * Super Admin) are not restricted by this — they plan ahead.
 *
 * A refusal always carries a REASON the Venture can read, so nobody is left
 * guessing why their booking was rejected: the reason names the actual state
 * (locked / already completed / a different Journey is current) and, where it
 * helps, the milestone that has to be finished first.
 *
 * Returns { ok: true, milestone } or { ok: false, reason }.
 */
export async function assertBookableMilestone(db, { dbId, milestoneId }) {
  try {
    const milestonesResult = await db
      .execute({
        sql: `SELECT id, title, status, journey_stage_id, is_archived
              FROM venture_milestones WHERE id::text = ? AND venture_id = ?`,
        args: [String(milestoneId), dbId],
      })
      .catch(() =>
        db.execute({
          sql: `SELECT id, title, status, journey_stage_id
                FROM venture_milestones WHERE id::text = ? AND venture_id = ?`,
          args: [String(milestoneId), dbId],
        }).catch(() => ({ rows: [] })),
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
    if (milestone.status === "locked") {
      return { ok: false, reason: "This milestone is locked. It opens once the milestone before it is completed." };
    }

    // The milestone must belong to the Journey that is actually current.
    const stageResult = await db
      .execute({
        sql: `SELECT id, name, status FROM venture_journey_stages
              WHERE id = ? AND venture_id = ?`,
        args: [String(milestone.journey_stage_id), dbId],
      })
      .catch(() => ({ rows: [] }));
    const stage = rowsOf(stageResult)[0];
    if (!stage) {
      return { ok: false, reason: "This milestone is not part of a Journey, so no session can be booked against it." };
    }
    if (stage.status === "locked") {
      return {
        ok: false,
        reason: `The Journey "${stage.name}" has not started yet. It opens once the previous Journey is completed.`,
      };
    }
    if (stage.status !== "active") {
      return { ok: false, reason: `The Journey "${stage.name}" is finished, so its milestones take no new sessions.` };
    }

    // ...and it must be the FIRST unfinished milestone of that Journey. Only one
    // milestone is open at a time; the rest are hidden from the Venture.
    const listResult = await db
      .execute({
        sql: `SELECT id, title, status FROM venture_milestones
              WHERE venture_id = ? AND journey_stage_id = ? AND COALESCE(is_archived, FALSE) = FALSE
              ORDER BY COALESCE(display_order, 0) ASC, created_at ASC`,
        args: [dbId, String(milestone.journey_stage_id)],
      })
      .catch(() => ({ rows: [] }));
    const current = rowsOf(listResult).find((milestone) => !isMilestoneComplete(milestone.status));
    if (current && String(current.id) !== String(milestone.id)) {
      return {
        ok: false,
        reason: `Your current milestone is "${current.title || "the open milestone"}". Finish it before booking against this one.`,
      };
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
 * The stored milestone vocabulary (locked | not_started | in_progress |
 * under_review | changes_requested | completed) was only ever half written:
 * creation states and `completed` existed, while the three work states the
 * lexicon already defines were never produced. So a milestone whose evidence
 * had been submitted and approved still read "Not Started", and a Journey's
 * "x/y milestones" never moved — a founder could see an approved deliverable,
 * a 67% bar and "Not Started" on the same row.
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
 * Move a milestone to the status its deliverables imply, after evidence was
 * submitted or reviewed.
 *
 * Two lines are never crossed:
 *   - a `locked` milestone is unreleased planning; the work inside it cannot be
 *     what releases it, and
 *   - a `completed` milestone is the manager's decision already taken; later
 *     evidence never reopens it.
 *
 * Completion keeps its AUTHORITY: when every deliverable is approved the
 * milestone closes — unlocking the next one and, if that was the last, closing
 * the Journey — but ONLY for an actor who may complete milestones (the Lead
 * Manager / a Super Admin). A scoped coach, who may REVIEW a deliverable but
 * holds no `milestones.edit`, moves the milestone to `in_progress` and leaves
 * the sign-off where it belongs.
 *
 * Returns { changed, status, journey_completed?, journey? }.
 */
export async function syncMilestoneStatusFromDeliverables(db, { dbId, milestoneId, cid = null, canComplete = false }) {
  if (!milestoneId || !dbId) return { changed: false, status: null };
  try {
    const milestoneResult = await db
      .execute({
        sql: "SELECT id, title, status, journey_stage_id FROM venture_milestones WHERE id = ? AND venture_id = ?",
        args: [milestoneId, dbId],
      })
      .catch(() => ({ rows: [] }));
    const milestone = rowsOf(milestoneResult)[0];
    if (!milestone) return { changed: false, status: null };
    if (milestone.status === "locked" || isMilestoneComplete(milestone.status)) {
      return { changed: false, status: milestone.status };
    }

    const deliverablesResult = await db
      .execute({
        sql: "SELECT status, approval_status FROM venture_deliverables WHERE milestone_id::text = ?",
        args: [String(milestoneId)],
      })
      .catch(() => ({ rows: [] }));

    let target = deriveMilestoneStatusFromDeliverables(rowsOf(deliverablesResult));
    if (!target || target === milestone.status) return { changed: false, status: milestone.status };

    if (target === "completed") {
      if (!canComplete) {
        // The work is done, but closing a milestone is not the reviewer's call.
        target = "in_progress";
      } else {
        await completeMilestoneAndUnlockNext(db, { dbId, milestoneId });
        const stageOutcome = await completeStageIfAllMilestonesDone(db, {
          dbId,
          stageId: milestone.journey_stage_id,
          cid,
        });
        return {
          changed: true,
          status: "completed",
          milestone_title: milestone.title || null,
          journey_completed: Boolean(stageOutcome?.completed),
          journey: stageOutcome?.completed
            ? {
                id: milestone.journey_stage_id ? String(milestone.journey_stage_id) : null,
                name: stageOutcome.stage_name || null,
                next_stage_id: stageOutcome.next_stage_id || null,
              }
            : null,
        };
      }
    }

    await db.execute({
      sql: "UPDATE venture_milestones SET status = ?, updated_at = NOW() WHERE id = ? AND venture_id = ?",
      args: [target, milestoneId, dbId],
    });
    return { changed: true, status: target };
  } catch (_) {
    return { changed: false, status: null };
  }
}

/**
 * Mark a milestone completed and unlock the next locked milestone in the
 * same stage. Returns { unlocked_milestone_id } (null when none follows).
 * Assumes the caller already verified completion authority.
 */
export async function completeMilestoneAndUnlockNext(db, { dbId, milestoneId }) {
  const milestoneResult = await db.execute({
    sql: `SELECT id, journey_stage_id FROM venture_milestones WHERE id = ? AND venture_id = ?`,
    args: [milestoneId, dbId],
  });
  const milestone = rowsOf(milestoneResult)[0];
  if (!milestone) return { error: "Milestone not found." };

  await db.execute({
    sql: "UPDATE venture_milestones SET status = 'completed', progress = 100, updated_at = NOW() WHERE id = ?",
    args: [milestoneId],
  });

  if (!milestone.journey_stage_id) return { unlocked_milestone_id: null };

  const nextResult = await db.execute({
    sql: `SELECT id FROM venture_milestones
          WHERE venture_id = ? AND journey_stage_id = ? AND status = 'locked'
          ORDER BY COALESCE(display_order, 0), created_at ASC
          LIMIT 1`,
    args: [dbId, milestone.journey_stage_id],
  });
  const next = rowsOf(nextResult)[0];
  if (!next) return { unlocked_milestone_id: null };

  await db.execute({
    sql: "UPDATE venture_milestones SET status = 'not_started', updated_at = NOW() WHERE id = ?",
    args: [next.id],
  });
  return { unlocked_milestone_id: next.id };
}

export default { isMilestoneLeadAuthority, resolveVentureCode, canManageMilestones, computeInitialMilestoneStatus, releaseFirstMilestoneForStage, completeStageIfAllMilestonesDone, completeMilestoneAndUnlockNext, assertBookableMilestone, deriveMilestoneStatusFromDeliverables, syncMilestoneStatusFromDeliverables };
