/**
 * VENTURE MILESTONES AND DELIVERABLES.
 *
 * The milestone read, the deliverables of a milestone, and the deliverable
 * create / update — including the evidence-submission and review workflow, and
 * the milestone progress recount that follows.
 *
 * The decisions — which columns an update may touch, how the approval workflow
 * folds into that set (one assignment per column), and the progress percentage
 * — live here; every statement is in `@/models/ventureDeliverablesStore`.
 * Nothing here runs SQL.
 *
 * Re-exported unchanged through `@/lib/ventures` (the module it came from) —
 * see docs/LAYER_SPLIT.md.
 */

import {
  selectMilestoneById,
  selectDeliverableCountsByMilestone,
  updateMilestoneProgress,
  selectDeliverablesByMilestone,
  selectDeliverableById,
  insertDeliverable,
  updateDeliverableColumns,
  insertDeliverableReview,
} from "@/models/ventureDeliverablesStore";

export async function getMilestone(milestoneId) {
  const res = await selectMilestoneById(milestoneId);
  if (res.rows.length === 0) return null;
  const milestone = res.rows[0];
  milestone.assigned_members = typeof milestone.assigned_members === "string" ? JSON.parse(milestone.assigned_members) : (milestone.assigned_members || []);
  return milestone;
}

// ─── Deliverables ─────────────────────────────────────────────────────────

export async function listDeliverables(milestoneId) {
  const res = await selectDeliverablesByMilestone(milestoneId);
  return res.rows || [];
}

export async function getDeliverable(deliverableId) {
  const res = await selectDeliverableById(deliverableId);
  return res.rows[0] || null;
}

export async function createDeliverable({ milestoneId, ventureId, title, description, deliverableType, dueDate, assignedCid, assignedName, createdBy }) {
  const res = await insertDeliverable({
    milestoneId,
    ventureId,
    title: title.trim(),
    description: description?.trim() || null,
    deliverableType: deliverableType || "document",
    dueDate: dueDate || null,
    assignedCid: assignedCid || null,
    assignedName: assignedName ? String(assignedName).trim() : null,
    createdBy: createdBy || "system",
  });
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function updateDeliverable(deliverableId, updates, actorCid, actorName) {
  const allowed = ["title", "description", "deliverable_type", "status", "due_date", "assigned_cid", "attachment_url", "attachment_name", "approval_status", "reviewer_cid", "reviewer_name", "rejection_reason"];
  // One assignment per column. The list used to be built by pushing, and the
  // approval workflow pushed a column the caller may already have supplied —
  // `status` on a submission, `reviewer_cid` / `reviewer_name` on a review —
  // which Postgres refuses outright ("multiple assignments to same column"),
  // losing the submission the founder had just uploaded. A Map cannot.
  const assignments = new Map();
  for (const column of allowed) {
    if (updates[column] !== undefined) assignments.set(column, updates[column]);
  }

  // Handle approval workflow. Its values win over the caller's, exactly as they
  // did when the same column was assigned twice and the last one took effect.
  const reviewed = updates.approval_status === "approved" || updates.approval_status === "rejected";
  if (reviewed) {
    assignments.set("reviewer_cid", updates.reviewer_cid || actorCid);
    assignments.set("reviewer_name", updates.reviewer_name || actorName);
    if (updates.approval_status === "approved") assignments.set("status", "completed");

    await insertDeliverableReview(
      deliverableId,
      actorCid || "system",
      actorName || "System",
      updates.approval_status,
      updates.rejection_reason || null,
    );
  }

  const sets = []; const args = [];
  for (const [column, value] of assignments) {
    sets.push(`${column} = ?`);
    args.push(value);
  }
  if (reviewed) sets.push("reviewed_at = NOW()");

  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()");
  args.push(deliverableId);
  await updateDeliverableColumns(sets, args);

  // Recalculate milestone completion
  const deliverable = await getDeliverable(deliverableId);
  if (deliverable) {
    const countResult = await selectDeliverableCountsByMilestone(deliverable.milestone_id);
    const counts = countResult.rows[0] || { t: 0, d: 0 };
    const pct = counts.t > 0 ? Math.round((counts.d / counts.t) * 100) : 0;
    // `progress` is the canonical milestone progress column (the one the Journey
    // spine and the milestone PATCH route read/write). The 016-era
    // `completion_percentage` only exists on databases whose milestone table was
    // created by that legacy DDL — on production it does NOT exist, and this
    // write is what made a founder's deliverable submission 500 *after* the file
    // was already stored.
    await updateMilestoneProgress(deliverable.milestone_id, pct);
  }

  return { updated: true };
}
